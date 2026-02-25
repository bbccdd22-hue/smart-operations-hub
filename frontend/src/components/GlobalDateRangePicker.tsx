/**
 * GlobalDateRangePicker – يُعيد تصدير UltimateDateRangePicker للمحافظة على التوافق
 * المكون الموحد: UltimateDateRangePicker
 */
import UltimateDateRangePicker from "./UltimateDateRangePicker";
import type { DateRange } from "../contexts/DateRangeContext";

export type { DateRange };

export default function GlobalDateRangePicker(
  props: React.ComponentProps<typeof UltimateDateRangePicker>
) {
  return <UltimateDateRangePicker {...props} />;
}
