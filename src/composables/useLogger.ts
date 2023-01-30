import { useI18n } from "vue-i18n";

export const useLogger = () => {
  const { t } = useI18n();
  const logger = ref<string[]>([]);

  function log(type: string, message: string) {
    logger.value.push(`[${type}]: ${message}`);
  }

  function info(message: string) {
    log(t("logger.info"), message);
  }
  function success(message: string) {
    log(t("logger.success"), message);
  }
  function error(message: string) {
    log(t("logger.error"), message);
  }

  return {
    logger,
    info,
    success,
    error,
    log,
  };
};
