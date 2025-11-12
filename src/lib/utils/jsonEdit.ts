import { applyEdits, modify, type FormattingOptions, type JSONPath } from "jsonc-parser";

const defaultFormatting: FormattingOptions = {
  insertSpaces: true,
  tabSize: 2,
  eol: "\n",
};

export function applyEditAtPath(
  json: string,
  path: JSONPath,
  value: unknown,
  formatting: FormattingOptions = defaultFormatting
): string {
  const edits = modify(json, path, value, { formattingOptions: formatting });
  return applyEdits(json, edits);
}

export function applyMultipleEdits(
  json: string,
  updates: Array<{ path: JSONPath; value: unknown }>,
  formatting: FormattingOptions = defaultFormatting
): string {
  let result = json;
  for (const { path, value } of updates) {
    const edits = modify(result, path, value, { formattingOptions: formatting });
    result = applyEdits(result, edits);
  }
  return result;
}
