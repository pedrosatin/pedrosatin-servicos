
const KEY = 'd7a5e84f691c49b5894b910e3090881b';
const HOST = 'servicos.pedrosatin.com';
const URLS = [`https://${HOST}/`];

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: URLS,
};

async function submitIndexNow() {
  try {
    console.log(`IndexNow: Enviando notificação para api.indexnow.org para ${URLS.length} URL(s)...`);
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 200 || res.status === 202) {
      console.log(`IndexNow: Sucesso (HTTP ${res.status}). URLs submetidas com sucesso.`);
    } else {
      const text = await res.text();
      console.warn(`IndexNow: Resposta com status ${res.status}: ${text}`);
    }
  } catch (error) {
    console.error('IndexNow: Falha ao enviar requisição:', error);
  }
}

submitIndexNow();
