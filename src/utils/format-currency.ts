import type { FormatInput } from "@/types/FormInputType";

const khmerToLatinMap: Record<string, string> = {
  "០": "0",
  "១": "1",
  "២": "2",
  "៣": "3",
  "៤": "4",
  "៥": "5",
  "៦": "6",
  "៧": "7",
  "៨": "8",
  "៩": "9",
};

const convertKhmerToLatin = (str: string) =>
  str.replace(/[០-៩]/g, (char) => khmerToLatinMap[char] || char);

export const formatWithCommas = (input: FormatInput, locale = "en-US"): string => {
  if (input === null || input === undefined) return "0";

  let value: number;
  if (typeof input === "string") {
    const latinStr = convertKhmerToLatin(input);
    value = Number(latinStr);
    if (isNaN(value)) return input;
  } else {
    value = input;
  }

  return new Intl.NumberFormat(locale).format(value);
};
