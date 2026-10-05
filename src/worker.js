const MAX_NUMBER = 300;

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function validateReservation(payload) {
  const { name, email, phone, numbers } = payload || {};
  const phoneDigits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";

  if (typeof name !== "string" || name.trim().length < 3 || name.length > 160) {
    return "Informe um nome válido.";
  }
  if (typeof email !== "string" || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
    return "Informe um e-mail válido.";
  }
  if (phoneDigits.length !== 11) {
    return "Informe um celular com DDD e 9 dígitos.";
  }
  if (!Array.isArray(numbers) || numbers.length < 1 || numbers.length > MAX_NUMBER + 1) {
    return "Selecione pelo menos um número válido.";
  }
  if (numbers.some((number) => !Number.isInteger(number) || number < 0 || number > MAX_NUMBER)
    || new Set(numbers).size !== numbers.length) {
    return "A lista de números selecionados é inválida.";
  }
  return null;
}

async function unavailableNumbers(db, numbers) {
  const result = await db.prepare(`
    SELECT number
    FROM raffle_numbers
    WHERE number IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
    ORDER BY number
  `).bind(JSON.stringify(numbers)).all();
  return result.results.map((row) => row.number);
}

async function reserveNumbers(db, payload) {
  const validationError = validateReservation(payload);
  if (validationError) return jsonResponse({ error: validationError }, 400);

  const { name, email, phone, numbers } = payload;
  const alreadyUnavailable = await unavailableNumbers(db, numbers);
  if (alreadyUnavailable.length) {
    return jsonResponse({
      error: "Alguns números já foram reservados.",
      unavailableNumbers: alreadyUnavailable
    }, 409);
  }

  const reservationId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO reservations (id, name, email, phone)
        VALUES (?, ?, ?, ?)
      `).bind(reservationId, name.trim(), email.trim(), phone.trim()),
      db.prepare(`
        INSERT INTO raffle_numbers (number, reservation_id)
        SELECT CAST(value AS INTEGER), ?
        FROM json_each(?)
      `).bind(reservationId, JSON.stringify(numbers))
    ]);
  } catch (error) {
    const conflicts = await unavailableNumbers(db, numbers);
    if (conflicts.length) {
      return jsonResponse({
        error: "Alguns números já foram reservados.",
        unavailableNumbers: conflicts
      }, 409);
    }
    console.error("D1 reservation batch failed", error);
    return jsonResponse({ error: "Erro ao processar a reserva." }, 500);
  }

  return jsonResponse({ reservationId }, 201);
}

async function handleApi(request, env, url) {
  if (url.pathname === "/api/raffle/numbers" && request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT number FROM raffle_numbers ORDER BY number"
    ).all();
    return jsonResponse({ unavailableNumbers: result.results.map((row) => row.number) });
  }

  if (url.pathname === "/api/raffle/reservations" && request.method === "POST") {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_384) {
      return jsonResponse({ error: "A solicitação é muito grande." }, 413);
    }
    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "O corpo da solicitação é inválido." }, 400);
    }
    return reserveNumbers(env.DB, payload);
  }

  if (url.pathname.startsWith("/api/")) {
    return jsonResponse({ error: "Rota não encontrada." }, 404);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      const apiResponse = await handleApi(request, env, url);
      if (apiResponse) return apiResponse;
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker request failed", error);
      return jsonResponse({ error: "Erro interno ao processar a solicitação." }, 500);
    }
  }
};
