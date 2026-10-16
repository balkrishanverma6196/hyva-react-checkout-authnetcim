/**
 * Authorize.Net Accept.js: card data goes straight from the browser to
 * Authorize.Net and comes back as a one-time "opaque data" token, so the card
 * number never reaches Magento (Paradox Labs refuses raw card numbers while
 * Accept.js is enabled).
 */
const ACCEPT_JS_URL = {
  live: 'https://js.authorize.net/v1/Accept.js',
  sandbox: 'https://jstest.authorize.net/v1/Accept.js',
};

let loading = null;

export function loadAcceptJs(sandbox) {
  if (window.Accept) {
    return Promise.resolve(window.Accept);
  }
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = sandbox ? ACCEPT_JS_URL.sandbox : ACCEPT_JS_URL.live;
      script.charset = 'utf-8';
      script.onload = () => resolve(window.Accept);
      script.onerror = () => {
        loading = null;
        reject(new Error('The secure card form could not be loaded.'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/**
 * @returns {Promise<{dataDescriptor: string, dataValue: string}>}
 */
export function tokenizeCard(config, card) {
  return new Promise((resolve, reject) => {
    window.Accept.dispatchData(
      {
        authData: {
          clientKey: config.clientKey,
          apiLoginID: config.apiLoginId,
        },
        cardData: {
          cardNumber: card.number,
          month: card.month,
          year: card.year,
          cardCode: card.cvv,
        },
      },
      (response) => {
        if (response.messages.resultCode === 'Error') {
          reject(
            new Error(
              response.messages.message.map((m) => m.text).join(' ') ||
                'Your card could not be verified.'
            )
          );
          return;
        }
        resolve(response.opaqueData);
      }
    );
  });
}
