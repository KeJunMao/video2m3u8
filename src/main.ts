import "uno.css";
import en from "./locales/en.json";
import zhCn from "./locales/zh-CN.json";

import { createApp } from "vue";
import { createI18n } from "vue-i18n";
const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "zh-CN",
  fallbackLocale: "en",
  messages: {
    en,
    "zh-CN": zhCn,
  },
});

import App from "./App.vue";

const app = createApp(App);
app.use(i18n);

app.mount("#app");
