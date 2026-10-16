import sendRequest from '../../api/sendRequest';
import LocalStorage from '../../utils/localStorage';

const CHECKOUT_CONFIG_QUERY = `
query authnetcimCheckoutConfig {
  tokenBaseCheckoutConfig(method: "authnetcim") {
    apiLoginId
    clientKey
    sandbox
    useVault
    canSaveCard
    forceSaveCard
    requireCcv
    canStoreBin
    availableTypes { key value }
  }
}`;

const STORED_CARDS_QUERY = `
query authnetcimCards {
  tokenBaseCards {
    hash
    label
    method
    active
  }
}`;

const SET_PAYMENT_MUTATION = `
mutation authnetcimSetPayment($cartId: String!, $data: TokenBaseCardPaymentInput!) {
  setPaymentMethodOnCart(input: {
    cart_id: $cartId
    payment_method: { code: "authnetcim", tokenbase_data: $data }
  }) {
    cart { selected_payment_method { code } }
  }
}`;

export async function fetchCheckoutConfig(dispatch) {
  const response = await sendRequest(dispatch, {
    query: CHECKOUT_CONFIG_QUERY,
  });
  return response?.data?.tokenBaseCheckoutConfig || null;
}

export async function fetchStoredCards(dispatch) {
  const response = await sendRequest(dispatch, { query: STORED_CARDS_QUERY });
  return (response?.data?.tokenBaseCards || []).filter(
    (card) => card.method === 'authnetcim' && card.active
  );
}

export function setPaymentData(dispatch, data) {
  return sendRequest(dispatch, {
    query: SET_PAYMENT_MUTATION,
    variables: { cartId: LocalStorage.getCartId(), data },
  });
}
