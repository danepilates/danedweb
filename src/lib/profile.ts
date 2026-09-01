export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  medical_conditions: string | null;
  injuries: string | null;
  allergies: string | null;
  is_admin: boolean;
  plan_type: string;
  plan_start_date: string | null;
  plan_end_date: string | null;
  plan_classes_total: number | null;
  plan_classes_remaining: number | null;
};

export type CustomField = {
  id: string;
  label: string;
  field_type: "text" | "number" | "boolean";
  required: boolean;
};

export type CustomValue = {
  field_id: string;
  value: string | null;
};

const REQUIRED_CORE_FIELDS: (keyof Profile)[] = [
  "full_name",
  "phone",
  "age",
  "height_cm",
  "weight_kg",
  "medical_conditions",
  "injuries",
  "allergies",
];

export function isProfileComplete(
  profile: Profile | null,
  customFields: CustomField[],
  customValues: CustomValue[],
): boolean {
  if (!profile) return false;

  const coreComplete = REQUIRED_CORE_FIELDS.every((key) => {
    const value = profile[key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
  if (!coreComplete) return false;

  const valueByField = new Map(customValues.map((v) => [v.field_id, v.value]));
  return customFields
    .filter((f) => f.required)
    .every((f) => {
      const value = valueByField.get(f.id);
      return value !== null && value !== undefined && value.trim() !== "";
    });
}
