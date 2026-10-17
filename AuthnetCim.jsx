import React, { useCallback, useEffect, useRef, useState } from 'react';
import { func, shape, string } from 'prop-types';

import RadioInput from '../../components/common/Form/RadioInput';
import { __ } from '../../i18n';
import { GraphQLResponseException } from '../../api/utility';
import useAppContext from '../../hook/useAppContext';
import useCheckoutFormContext from '../../hook/useCheckoutFormContext';
import { fetchCheckoutConfig, fetchStoredCards, setPaymentData } from './api';
import { loadAcceptJs, tokenizeCard } from './acceptJs';
import { detectType, digitsOnly, validateCard } from './card';
import { placeOrderOrThrow } from './graphql';

const METHOD = 'authnetcim';
const NEW_CARD = '';
const EMPTY_CARD = { number: '', month: '', year: '', cvv: '' };

const inputClass =
  'form-input w-full rounded border border-gray-300 px-3 py-2 text-sm';

/**
 * Authorize.Net CIM (Paradox Labs) for the Hyvä React Checkout.
 *
 * Card details live only in this component's state (never in the checkout
 * form values or local storage). On "Place Order" they are tokenized with
 * Accept.js, the token is set on the cart via `tokenbase_data`, and the order
 * is placed. Logged-in customers can pay with, or save, a stored card.
 */
function AuthnetCim({ method, selected, actions }) {
  const isSelected = selected?.code === METHOD;
  const { appDispatch, setErrorMessage, isLoggedIn } = useAppContext();
  const { registerPaymentAction } = useCheckoutFormContext();
  const [config, setConfig] = useState(null);
  const [storedCards, setStoredCards] = useState([]);
  const [cardId, setCardId] = useState(NEW_CARD);
  const [card, setCard] = useState(EMPTY_CARD);
  const [saveCard, setSaveCard] = useState(false);
  const [loadError, setLoadError] = useState('');

  // The registered action is created once; read the latest input through a ref.
  const latest = useRef({});
  latest.current = { config, cardId, card, saveCard, isLoggedIn };

  useEffect(() => {
    if (!isSelected || config) {
      return;
    }
    (async () => {
      try {
        const checkoutConfig = await fetchCheckoutConfig(appDispatch);
        if (!checkoutConfig?.clientKey || !checkoutConfig?.apiLoginId) {
          throw new Error('Card payments are not configured.');
        }
        setConfig(checkoutConfig);
        loadAcceptJs(checkoutConfig.sandbox).catch(() =>
          setLoadError(__('The secure card form could not be loaded.'))
        );
        if (isLoggedIn && checkoutConfig.useVault) {
          const cards = await fetchStoredCards(appDispatch);
          setStoredCards(cards);
          if (cards.length) {
            setCardId(cards[0].hash);
          }
        }
      } catch (error) {
        setLoadError(error.message || __('Card payments are not available.'));
      }
    })();
  }, [isSelected, config, appDispatch, isLoggedIn]);

  const placeOrder = useCallback(async () => {
    const {
      config: cfg,
      cardId: storedCard,
      card: input,
      saveCard: save,
      isLoggedIn: loggedIn,
    } = latest.current;

    try {
      if (!cfg) {
        throw new Error(__('Card payments are not available.'));
      }

      let data;
      if (storedCard) {
        data = { card_id: storedCard };
        if (cfg.requireCcv) {
          data.cc_cid = digitsOnly(input.cvv);
        }
      } else {
        const allowedTypes = (cfg.availableTypes || []).map((t) => t.key);
        const problem = validateCard(input, allowedTypes);
        if (problem) {
          throw new Error(__(problem));
        }
        const digits = digitsOnly(input.number);
        await loadAcceptJs(cfg.sandbox);
        const token = await tokenizeCard(cfg, {
          number: digits,
          month: String(input.month).padStart(2, '0'),
          year: String(input.year),
          cvv: digitsOnly(input.cvv),
        });
        data = {
          acceptjs_key: token.dataDescriptor,
          acceptjs_value: token.dataValue,
          cc_type: detectType(digits).code,
          cc_last4: digits.slice(-4),
          cc_exp_month: String(Number(input.month)),
          cc_exp_year: String(input.year),
          save: loggedIn && cfg.canSaveCard && (cfg.forceSaveCard || save),
        };
        if (cfg.canStoreBin) {
          data.cc_bin = digits.slice(0, 6);
        }
      }

      await setPaymentData(appDispatch, data);
      const order = await placeOrderOrThrow(appDispatch);
      setCard(EMPTY_CARD);
      return order;
    } catch (error) {
      // GraphQL errors are already shown by sendRequest; show our own ones.
      if (!(error instanceof GraphQLResponseException)) {
        setErrorMessage(
          error?.message || __('Your payment could not be processed.')
        );
      }
      return {};
    }
  }, [appDispatch, setErrorMessage]);

  useEffect(() => {
    registerPaymentAction(METHOD, placeOrder);
  }, [registerPaymentAction, placeOrder]);

  const updateCard = (field) => (event) =>
    setCard((current) => ({ ...current, [field]: event.target.value }));

  const now = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => now + i);
  const type = detectType(card.number);

  return (
    <div>
      <RadioInput
        value={method.code}
        label={method.title}
        name="paymentMethod"
        checked={isSelected}
        onChange={actions.change}
      />

      {isSelected && (
        <div className="mt-3 mb-2 ml-6 space-y-3 rounded-lg border border-gray-200 p-4">
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}

          {storedCards.length > 0 && (
            <div className="space-y-1">
              {storedCards.map((stored) => (
                <div
                  key={stored.hash}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    id={`authnetcim-card-${stored.hash}`}
                    type="radio"
                    className="form-radio"
                    checked={cardId === stored.hash}
                    onChange={() => setCardId(stored.hash)}
                  />
                  <label htmlFor={`authnetcim-card-${stored.hash}`}>
                    {stored.label}
                  </label>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm">
                <input
                  id="authnetcim-card-new"
                  type="radio"
                  className="form-radio"
                  checked={cardId === NEW_CARD}
                  onChange={() => setCardId(NEW_CARD)}
                />
                <label htmlFor="authnetcim-card-new">
                  {__('Use a new card')}
                </label>
              </div>
            </div>
          )}

          {cardId === NEW_CARD && (
            <>
              <div className="text-sm">
                <label
                  htmlFor="authnetcim-cc-number"
                  className="mb-1 block font-semibold"
                >
                  {__('Card Number')}
                </label>
                <span className="relative block">
                  <input
                    id="authnetcim-cc-number"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    className={inputClass}
                    placeholder="•••• •••• •••• ••••"
                    maxLength={23}
                    value={card.number}
                    onChange={updateCard('number')}
                  />
                  {type && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                      {type.code}
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-sm">
                  <label
                    htmlFor="authnetcim-cc-month"
                    className="mb-1 block font-semibold"
                  >
                    {__('Month')}
                  </label>
                  <select
                    id="authnetcim-cc-month"
                    className={inputClass}
                    autoComplete="cc-exp-month"
                    value={card.month}
                    onChange={updateCard('month')}
                  >
                    <option value="">MM</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-sm">
                  <label
                    htmlFor="authnetcim-cc-year"
                    className="mb-1 block font-semibold"
                  >
                    {__('Year')}
                  </label>
                  <select
                    id="authnetcim-cc-year"
                    className={inputClass}
                    autoComplete="cc-exp-year"
                    value={card.year}
                    onChange={updateCard('year')}
                  >
                    <option value="">YYYY</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-sm">
                  <label
                    htmlFor="authnetcim-cc-cvv"
                    className="mb-1 block font-semibold"
                  >
                    {__('CVV')}
                  </label>
                  <input
                    id="authnetcim-cc-cvv"
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    className={inputClass}
                    maxLength={4}
                    value={card.cvv}
                    onChange={updateCard('cvv')}
                  />
                </div>
              </div>
              {isLoggedIn && config?.canSaveCard && !config?.forceSaveCard && (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    id="authnetcim-save-card"
                    type="checkbox"
                    className="form-checkbox"
                    checked={saveCard}
                    onChange={(event) => setSaveCard(event.target.checked)}
                  />
                  <label htmlFor="authnetcim-save-card">
                    {__('Save this card for next time')}
                  </label>
                </div>
              )}
            </>
          )}

          {cardId !== NEW_CARD && config?.requireCcv && (
            <div className="w-32 text-sm">
              <label
                htmlFor="authnetcim-stored-cvv"
                className="mb-1 block font-semibold"
              >
                {__('CVV')}
              </label>
              <input
                id="authnetcim-stored-cvv"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                className={inputClass}
                maxLength={4}
                value={card.cvv}
                onChange={updateCard('cvv')}
              />
            </div>
          )}

          <p className="text-xs text-gray-500">
            {__(
              'Card details are sent securely to Authorize.Net and never stored on this site.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}

AuthnetCim.propTypes = {
  method: shape({ code: string, title: string }).isRequired,
  selected: shape({ code: string }),
  actions: shape({ change: func }).isRequired,
};

AuthnetCim.defaultProps = {
  selected: {},
};

export default AuthnetCim;
