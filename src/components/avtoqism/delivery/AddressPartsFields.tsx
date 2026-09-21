/**
 * Region, district, street — and then the four pieces that actually get a
 * driver to a door: uy, podyezd, qavat, xonadon.
 *
 * Each is its own labelled field all the way to its own column in the database,
 * because "podyezd 3" typed into the street box is invisible on the delivery
 * card the founder reads from the windscreen cradle.
 */
import { MapPointPicker } from "./MapPointPicker";
import { TextField } from "./Fields";
import type { AddressParts, FieldErrors } from "./address";

export function AddressPartsFields({
  parts,
  errors,
  onChange,
  disabled = false,
}: {
  parts: AddressParts;
  errors: FieldErrors;
  onChange: (next: AddressParts) => void;
  disabled?: boolean | undefined;
}) {
  const set = (field: keyof AddressParts) => (value: string) =>
    onChange({ ...parts, [field]: value });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Viloyat"
          value={parts.region}
          onChange={set("region")}
          error={errors["region"]}
          autoComplete="address-level1"
          maxLength={80}
          placeholder="Toshkent"
          disabled={disabled}
          required
        />
        <TextField
          label="Tuman"
          value={parts.district}
          onChange={set("district")}
          error={errors["district"]}
          autoComplete="address-level2"
          maxLength={80}
          placeholder="Chilonzor"
          disabled={disabled}
          required
        />
        <TextField
          className="sm:col-span-2"
          label="Ko'cha"
          value={parts.street}
          onChange={set("street")}
          error={errors["street"]}
          autoComplete="address-line1"
          maxLength={200}
          placeholder="Bunyodkor shoh ko'chasi"
          disabled={disabled}
          required
        />
      </div>

      {/* The four that the delivery card prints as separate labels. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Uy"
          value={parts.house}
          onChange={set("house")}
          error={errors["house"]}
          maxLength={40}
          placeholder="12A"
          disabled={disabled}
        />
        <TextField
          label="Podyezd"
          value={parts.entrance}
          onChange={set("entrance")}
          error={errors["entrance"]}
          inputMode="numeric"
          maxLength={20}
          placeholder="3"
          disabled={disabled}
        />
        <TextField
          label="Qavat"
          value={parts.floor}
          onChange={set("floor")}
          error={errors["floor"]}
          inputMode="numeric"
          maxLength={20}
          placeholder="5"
          disabled={disabled}
        />
        <TextField
          label="Xonadon"
          value={parts.apartment}
          onChange={set("apartment")}
          error={errors["apartment"]}
          inputMode="numeric"
          maxLength={20}
          placeholder="47"
          disabled={disabled}
        />
      </div>

      <TextField
        label="Mo'ljal (ixtiyoriy)"
        value={parts.landmark}
        onChange={set("landmark")}
        error={errors["landmark"]}
        maxLength={200}
        placeholder="Metro yonida, ko'k darvoza"
        hint="Kuryer adashmasligi uchun yaqin atrofdagi belgi."
        disabled={disabled}
      />

      <div className="border-t border-border pt-6">
        <MapPointPicker
          lat={parts.lat}
          lng={parts.lng}
          onChange={({ lat, lng }) => onChange({ ...parts, lat, lng })}
          error={errors["coordinates"]}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
