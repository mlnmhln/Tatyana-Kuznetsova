const clean = (value, max) => String(value ?? '').trim().slice(0, max);

const escapeHtml = (value) => value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));

const allowedRequests = new Set([
  'Записаться на диагностику',
  'Обсудить мою ситуацию',
  'Записаться к Татьяне',
  'Начать с диагностики',
  'Задать вопрос',
]);

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const requestUrl = new URL(request.url);
  if (origin && new URL(origin).host !== requestUrl.host) {
    return Response.json({ error: 'Недопустимый источник запроса.' }, { status: 403 });
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return Response.json({ error: 'Сервис заявок еще не настроен.' }, { status: 503 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Некорректные данные.' }, { status: 400 }); }

  const name = clean(body.name, 80);
  const contact = clean(body.contact, 120);
  const requestType = clean(body.request, 80);
  const website = clean(body.website, 120);
  const phoneLike = /^[+\d]/.test(contact);
  const validPhone = /^\+?\d{11}$/.test(contact);

  if (website) return Response.json({ ok: true });
  if (!name || !contact || (phoneLike && !validPhone) || !allowedRequests.has(requestType) || body.consent !== true) {
    return Response.json({ error: 'Заполните обязательные поля.' }, { status: 422 });
  }

  const text = [
    '<b>Новая заявка с сайта</b>',
    `Задача: ${escapeHtml(requestType)}`,
    `Имя: ${escapeHtml(name)}`,
    `Контакт: ${escapeHtml(contact)}`,
  ].filter(Boolean).join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
      signal: controller.signal,
    });
    if (!response.ok) return Response.json({ error: 'Не удалось передать заявку.' }, { status: 502 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Сервис временно недоступен.' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export function onRequest() {
  return Response.json({ error: 'Метод не поддерживается.' }, { status: 405, headers: { Allow: 'POST' } });
}
