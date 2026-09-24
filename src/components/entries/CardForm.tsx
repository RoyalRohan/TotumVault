import React, { useState } from 'react';
import { CreditCard, MapPin } from 'lucide-react';
import { DecryptedEntry, CustomField, CategoryType } from '../../types';
import { EntryFormShell } from './shared/EntryFormShell';
import { SecretInput } from './shared/SecretInput';
import { TagEditor } from './shared/TagEditor';
import { CustomFieldsEditor } from './shared/CustomFieldsEditor';
import { FormSection } from './shared/FormSection';

interface CardFormProps {
  initialData: DecryptedEntry | null;
  onSave: (entry: DecryptedEntry) => void;
  onClose: () => void;
  onCategoryChange: (cat: CategoryType) => void;
}

export const CardForm: React.FC<CardFormProps> = ({
  initialData,
  onSave,
  onClose,
  onCategoryChange,
}) => {
  const [cardName, setCardName] = useState(initialData?.title || '');
  const [cardholderName, setCardholderName] = useState(initialData?.cardholder_name || initialData?.username || '');
  const [cardNumber, setCardNumber] = useState(initialData?.card_number || '');
  const [expMonth, setExpMonth] = useState(initialData?.card_exp_month || '');
  const [expYear, setExpYear] = useState(initialData?.card_exp_year || '');
  const [cvv, setCvv] = useState(initialData?.card_cvv || '');
  const [pin, setPin] = useState(initialData?.card_pin || '');
  const [cardType, setCardType] = useState(initialData?.card_type || 'visa');
  const [billingAddress, setBillingAddress] = useState(initialData?.card_billing_address || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [favorite, setFavorite] = useState(initialData?.favorite || false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialData?.custom_fields || []);

  const formatCardNumber = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 19);
    // Auto detect card type
    if (raw.startsWith('4')) setCardType('Visa');
    else if (raw.startsWith('5') || raw.startsWith('2')) setCardType('Mastercard');
    else if (raw.startsWith('34') || raw.startsWith('37')) setCardType('American Express');
    else if (raw.startsWith('6')) setCardType('Discover');

    const chunks = raw.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : raw;
  };

  const handleCardNumberChange = (val: string) => {
    setCardNumber(formatCardNumber(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) return;

    const entryToSave: DecryptedEntry = {
      id: initialData ? initialData.id : '',
      title: cardName.trim(),
      username: cardholderName.trim(),
      email: '',
      password: '',
      url: '',
      notes: notes.trim(),
      category: 'cards',
      favorite,
      tags,
      custom_fields: customFields.filter((f) => f.name.trim()),
      cardholder_name: cardholderName.trim(),
      card_number: cardNumber.replace(/\s+/g, ''),
      card_exp_month: expMonth.trim(),
      card_exp_year: expYear.trim(),
      card_cvv: cvv.trim(),
      card_pin: pin.trim(),
      card_type: cardType,
      card_billing_address: billingAddress.trim(),
      created_at: initialData ? initialData.created_at : '',
      updated_at: '',
    };

    onSave(entryToSave);
  };

  return (
    <EntryFormShell
      title={cardName || 'Card'}
      isEditing={Boolean(initialData)}
      category="cards"
      onCategoryChange={onCategoryChange}
      favorite={favorite}
      onFavoriteToggle={() => setFavorite(!favorite)}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitDisabled={!cardName.trim()}
    >
      {/* Card Nickname & Network */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Card Nickname <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="e.g. Chase Sapphire, Work Visa, Personal Amex..."
            required
            autoFocus
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Card Network
          </label>
          <select
            value={cardType}
            onChange={(e) => setCardType(e.target.value)}
            className="w-full input-themed rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none"
          >
            <option value="Visa">Visa</option>
            <option value="Mastercard">Mastercard</option>
            <option value="American Express">American Express</option>
            <option value="Discover">Discover</option>
            <option value="Debit / Other">Debit / Other</option>
          </select>
        </div>
      </div>

      {/* Card Details Group */}
      <FormSection title="Card Information" icon={<CreditCard className="w-3.5 h-3.5 text-indigo-400" />}>
        <div>
          <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block mb-1.5">
            Cardholder Name
          </label>
          <input
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            placeholder="Name as it appears on card..."
            className="w-full input-themed rounded-xl px-3.5 py-2.5 text-sm placeholder-slate-400 focus:outline-none uppercase font-mono"
          />
        </div>

        <SecretInput
          label="Card Number"
          value={cardNumber}
          onChange={handleCardNumberChange}
          placeholder="•••• •••• •••• ••••"
          copyLabel="Card Number"
        />

        {/* Expiry & Security Codes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
              Exp Month
            </label>
            <input
              type="text"
              maxLength={2}
              value={expMonth}
              onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ''))}
              placeholder="MM (01-12)"
              className="w-full input-themed rounded-xl px-3 py-2 text-sm text-center font-mono placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
              Exp Year
            </label>
            <input
              type="text"
              maxLength={4}
              value={expYear}
              onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ''))}
              placeholder="YYYY (2028)"
              className="w-full input-themed rounded-xl px-3 py-2 text-sm text-center font-mono placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
              CVV / CVC
            </label>
            <input
              type="password"
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
              placeholder="•••"
              className="w-full input-themed rounded-xl px-3 py-2 text-sm text-center font-mono placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-theme-text-muted uppercase tracking-wider block mb-1">
              PIN (Optional)
            </label>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full input-themed rounded-xl px-3 py-2 text-sm text-center font-mono placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </FormSection>

      {/* Billing Address */}
      <FormSection title="Billing Address" icon={<MapPin className="w-3.5 h-3.5 text-indigo-500" />}>
        <textarea
          rows={2}
          value={billingAddress}
          onChange={(e) => setBillingAddress(e.target.value)}
          placeholder="Street address, city, state, postal code, country..."
          className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none resize-y"
        />
      </FormSection>

      {/* Tags */}
      <TagEditor tags={tags} onChange={setTags} />

      {/* Custom Fields */}
      <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
          Card Notes
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bank customer support phone, fraud alert notes..."
          className="w-full input-themed rounded-xl px-3.5 py-2 text-sm placeholder-slate-400 focus:outline-none font-mono resize-y"
        />
      </div>
    </EntryFormShell>
  );
};
