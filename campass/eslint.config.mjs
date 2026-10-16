import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // 생성 파일 제외
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".npm-cache/**",
  ]),
]);

export default eslintConfig;
