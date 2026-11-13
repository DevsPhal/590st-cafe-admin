// Shared by the login page and its dialogs (verification code, forgot password), in the café palette.
export const AUTH_FIELD_CLASS =
  "h-12 w-full rounded-xl border border-(--cafe-line) bg-white text-base text-(--cafe-espresso) outline-none transition-[border-color,box-shadow] placeholder:text-(--cafe-subtle) hover:border-(--cafe-line-strong) focus:border-(--cafe-caramel) focus:ring-4 focus:ring-(--cafe-caramel)/15 motion-reduce:transition-none";
export const AUTH_SUBMIT_CLASS =
  "mt-8 h-12 w-full rounded-xl bg-(--cafe-espresso) text-[15px] font-semibold text-(--cafe-foam) transition-colors hover:bg-(--cafe-espresso-hover) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--cafe-caramel)/35 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";
export const AUTH_DIALOG_CLASS =
  "max-w-md gap-0 rounded-3xl border-none bg-white p-0 text-(--cafe-espresso) shadow-2xl";
export const AUTH_DIALOG_BADGE_CLASS =
  "mx-auto mb-6 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-(--cafe-espresso) text-[#f3c58f] shadow-[0_0_0_6px_var(--cafe-sand),0_10px_24px_-10px_rgba(43,26,16,0.45)]";
