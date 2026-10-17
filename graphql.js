import sendRequest from '../../api/sendRequest';
import LocalStorage from '../../utils/localStorage';

const PLACE_ORDER_MUTATION = `
mutation placeOrderWithErrors($cartId: String!) {
  placeOrder(input: { cart_id: $cartId }) {
    order { order_number }
    errors { message code }
  }
}`;

function cleanMessage(message) {
  return String(message || '')
    .replace(/^Unable to place order:\s*/i, '')
    .trim();
}

/**
 * The checkout's sendRequest only raises GraphQL errors when `data` is empty,
 * but Magento reports gateway failures (e.g. a declined card) as errors next
 * to a non-empty `data.placeOrder`. Raise every error so the customer sees it.
 */
export async function sendOrThrow(dispatch, query, variables, path) {
  const response = await sendRequest(dispatch, { query, variables });
  const nestedErrors = (path && response?.data?.[path]?.errors) || [];
  const message = [...nestedErrors, ...(response?.errors || [])]
    .map((error) => cleanMessage(error?.message))
    .find(Boolean);
  if (message) {
    throw new Error(message);
  }
  return response;
}

/**
 * @returns {Promise<{order_number: string}>}
 */
export async function placeOrderOrThrow(dispatch) {
  const response = await sendOrThrow(
    dispatch,
    PLACE_ORDER_MUTATION,
    { cartId: LocalStorage.getCartId() },
    'placeOrder'
  );
  const order = response?.data?.placeOrder?.order;
  if (!order?.order_number) {
    throw new Error('Your order could not be placed. Please try again.');
  }
  return order;
}
