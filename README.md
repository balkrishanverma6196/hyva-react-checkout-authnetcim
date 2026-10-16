# Authorize.Net CIM (ParadoxLabs) for Hyvä React Checkout

A payment method renderer that lets the [Hyvä React Checkout](https://github.com/hyva-themes/magento2-react-checkout)
take card payments with the [ParadoxLabs Authorize.Net CIM](https://commercemarketplace.adobe.com/paradoxlabs-authnetcim.html)
module (`paradoxlabs/authnetcim`).

Out of the box the React Checkout has no renderer for `authnetcim`: the method is listed, but there is
nowhere to enter a card, and selecting it fails with `Undefined array key "tokenbase_data"`.

## Features

- Card number, expiry and CVV form with card type detection and client-side validation (Luhn, expiry, CVV length).
- **Accept.js tokenization**: card data goes straight from the browser to Authorize.Net and comes back as a
  one-time token; the card number never reaches Magento, and is never stored in the checkout's form state or
  local storage.
- Stored cards for logged-in customers (pick a saved card, or save the new one), following the module's
  "can save / force save / require CVV" settings.
- Uses the module's live/sandbox setting to load the right Accept.js.
- Gateway errors (declines, invalid card) are shown as checkout messages.

## Requirements

- Hyvä React Checkout `hyva-themes/magento2-react-checkout` 1.1.x
- `paradoxlabs/authnetcim` 6.x (with `paradoxlabs/tokenbase` 5.x)
- In **Stores > Configuration > Sales > Payment Methods > Authorize.Net CIM**:
  - *Payment Form Type*: **Accept.js**, with the **Public Client Key** filled in.
- In **Stores > Configuration > Sales > Checkout > TokenBase**: **Enable public API = Yes**
  (the renderer reads the checkout configuration and stored cards over GraphQL; without it these requests
  are refused with *"The TokenbaseCard API is not enabled"*).

## Installation

1. Add the repository to `reactapp/package.json` of the React Checkout (the key must be `authnetcim`):

   ```json
   "config": {
     "paymentMethodsRepo": {
       "authnetcim": "https://github.com/balkrishanverma6196/hyva-react-checkout-authnetcim.git"
     }
   }
   ```

2. Install and build the checkout:

   ```bash
   cd vendor/hyva-themes/magento2-react-checkout/src/reactapp
   npm install   # clones this repo into src/paymentMethods/authnetcim and registers it
   npm run build
   ```

   If you build from a copy of the app (recommended, so composer updates don't wipe your build), copy this
   repository to `src/paymentMethods/authnetcim/` and add it to `src/paymentMethods/customRenderers.js`:

   ```js
   import authnetcimRenderers from './authnetcim/renderers';

   export default {
     ...authnetcimRenderers,
   };
   ```

3. Deploy static content and flush the cache.

## How it works

1. When the customer selects the method, the renderer loads `tokenBaseCheckoutConfig(method: "authnetcim")`
   (API Login ID, client key, sandbox flag, stored card options) and, for logged-in customers, `tokenBaseCards`.
2. It registers itself as the payment action for `authnetcim`, so the checkout's **Place Order** runs it:
   - new card: validate, tokenize with `Accept.dispatchData`, then
     `setPaymentMethodOnCart(payment_method: { code: "authnetcim", tokenbase_data: { acceptjs_key, acceptjs_value, cc_type, cc_last4, cc_exp_month, cc_exp_year, save } })`;
   - stored card: `tokenbase_data: { card_id }` (plus `cc_cid` when CVV is required for stored cards);
   - then `placeOrder`.

## Limitations

- Credit cards only (no `authnetcim_ach` eCheck renderer).
- Accept.js form only (no Accept Hosted iframe).
- No "My Payment Options" account page (that is outside the checkout).

## License

BSD-3-Clause, see [LICENSE](LICENSE). Not affiliated with Hyvä Themes or ParadoxLabs.
