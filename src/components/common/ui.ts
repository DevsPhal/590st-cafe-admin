// The admin's shared components, one name each. Import from here in new code:
//   import { Button, Input, Select, Modal, Card, Loader, EmptyState, toast } from "@/components/common/ui";
// They use the design tokens in globals.scss (--color-*, --space-*, --radius-*, --shadow-*, --touch-target).
export { Button, type ButtonProps, type ButtonVariant } from "./Button";
export { Card } from "./Card";
export { EmptyState } from "./EmptyState";
export { Loader } from "./Loader";
export {
  ConfirmDialog,
  DataCard,
  DetailModal,
  ErrorState,
  FieldError,
  FormInput as Input,
  FormModal as Modal,
  FormSelect as Select,
  FormTextarea as Textarea,
  MoneyField,
  StatTile,
  TableState,
} from "./AdminKit";
export { default as toast } from "react-hot-toast";
