<script lang="ts" setup>
import { FFmpeg } from '@ffmpeg/ffmpeg'
import JsZip from "jszip";
import { OnUpdateFileList } from "naive-ui/es/upload/src/interface";
import { useI18n } from "vue-i18n";
import { useLogger } from "./composables/useLogger";
import type { LogEvent, ProgressEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const { logger, info, error, success, log } = useLogger();
const loading = ref(false);
const { t } = useI18n();
const baseURL = 'https://unpkg.zhimg.com/@ffmpeg/core-mt@0.12.4/dist/esm'

success(t("logger.message.create"));
const ffmpeg = new FFmpeg();

ffmpeg.on('log', (l: LogEvent) => {
  console.log(l);
  log(t(`logger.${l.type}`), l.message);
})

ffmpeg.on('progress', (p: ProgressEvent) => {
  console.log(p);
  success(`${p.progress * 100}%`);
})

onMounted(async () => {
  loading.value = true;
  info(t("logger.message.loading"));
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
  })
  success(t("logger.message.loaded"));
  loading.value = false;
});

const sourceVideoFile = ref<File>();
const keyFile = ref<File>();
const keyURI = ref("");
const keyIV = ref("");

const sourceVideoName = computed(() => {
  return sourceVideoFile.value?.name ?? "";
});

const outputFileNameWithoutExt = computed(() => {
  const name = sourceVideoName.value.split(".");
  name.pop();
  return name.join(".");
});

const outputTsNameTemplate = computed(() => {
  // return `${btoa(encodeURIComponent(outputFileNameWithoutExt.value))}-%d.ts`
  // return `${outputFileNameWithoutExt.value}-%d.ts`
  return "video-%d.ts"
});
const outputFileName = computed(() => {
  // return outputFileNameWithoutExt.value + ".m3u8";
  return '1.m3u8'
});

const onVideoFileUpdate: OnUpdateFileList = (list) => {
  sourceVideoFile.value = list[0]?.file ?? undefined;
};
const onKeyFileUpdate: OnUpdateFileList = (list) => {
  console.log(list);
  keyFile.value = list[0]?.file ?? undefined;
};

const tryCreateKeyInfoFile = () => {
  if (!keyURI.value) {
    info(t("logger.message.keyUrlEmpty"));
    return;
  }
  if (!keyFile.value) {
    info(t("logger.message.keyFileEmpty"));
    return;
  }
  return new File(
    [`${keyURI.value}\n${keyFile.value.name}\n${keyIV.value}`],
    "keyinfo",
    {
      type: "text/plain",
    }
  );
};

function downloadFile(data: any, name: string) {
  const url = URL.createObjectURL(data);
  const download = document.createElement("a");
  download.href = url;
  download.download = name;
  download.click();
}

async function handleConvert() {
  loading.value = true;
  if (sourceVideoFile.value) {
    info(
      t("logger.message.start", {
        name: sourceVideoName.value,
      })
    );
    info(t("logger.message.logTips"));
    await ffmpeg.writeFile(
      sourceVideoName.value,
      await fetchFile(sourceVideoFile.value)
    );
    let keyinfo: string[] = [];
    const keyinfoFile = tryCreateKeyInfoFile();

    if (keyinfoFile && keyFile.value) {
      await ffmpeg.writeFile(
        keyFile.value.name,
        await fetchFile(keyFile.value)
      );
      await ffmpeg.writeFile("keyinfo", await fetchFile(keyinfoFile));
      keyinfo = ["-hls_key_info_file", "keyinfo"];
    }
    await ffmpeg.exec(
      [
        "-i",
        sourceVideoName.value,
        "-y",
        "-c",
        "copy",
        "-hls_time",
        "10",
        "-hls_playlist_type",
        "vod",
        ...keyinfo,
        "-hls_segment_filename",
        outputTsNameTemplate.value,
        outputFileName.value
      ]
    );
    await ffmpeg.deleteFile(sourceVideoName.value);
    if (keyinfo.length) {
      await ffmpeg.deleteFile("keyinfo");
      await ffmpeg.deleteFile(keyFile.value?.name as string);
    }
    const zip = new JsZip();
    const dir = await ffmpeg.listDir(".");
    let isFail = true;

    for (let file of dir) {
      if (file.name.endsWith(".ts") || file.name.endsWith(".m3u8")) {
        isFail = false;
        const data = ffmpeg.readFile(file.name);
        zip.file(file.name, data);
        ffmpeg.deleteFile(file.name);
      }
    }
    if (isFail) {
      error(t("logger.message.fail"));
      return;
    }
    const data = await zip.generateAsync({ type: "blob" });
    downloadFile(data, outputFileNameWithoutExt.value + ".zip");
  } else {
    error(t("logger.message.videoEmpty"));
  }
  loading.value = false;
}
</script>
<template>
  <n-layout>
    <n-layout-header>
      <n-page-header p-4>
        <template #title> {{ $t("site.title") }} </template>
        <template #avatar>
          <n-icon i-carbon:document-video text-2xl />
        </template>
      </n-page-header>
    </n-layout-header>
    <n-layout-content content-style="padding: 24px;">
      <div container m-auto>
        <n-spin :show="loading">
          <div>
            <h2>{{ $t("form.video.label") }} <span color-red>*</span></h2>
            <n-upload directory-dnd accept="video/*" :max="1" :on-update:file-list="onVideoFileUpdate">
              <n-upload-dragger>
                <div mb-1>
                  <n-icon size="48" :depth="3" i-carbon:video> </n-icon>
                </div>
                <n-text> {{ $t("form.video.placeholder") }} </n-text>
              </n-upload-dragger>
            </n-upload>
          </div>
          <div>
            <h2>{{ $t("form.encryption.label") }}</h2>
            <n-grid :cols="2" x-gap="24">
              <n-gi>
                <h3>
                  {{ $t("form.encryption.keyUrl.label") }}
                  <span color-red>*</span>
                </h3>
                <n-input v-model:value="keyURI" type="text" :placeholder="$t('form.encryption.keyUrl.placeholder')" />
              </n-gi>
              <n-gi>
                <h3>{{ $t("form.encryption.iv.label") }}</h3>
                <n-input v-model:value="keyIV" type="text" placeholder="IV" />
              </n-gi>
            </n-grid>
            <h3>
              {{ $t("form.encryption.keyFile.label") }} <span color-red>*</span>
            </h3>
            <n-upload directory-dnd :max="1" :on-update:file-list="onKeyFileUpdate">
              <n-upload-dragger>
                <div mb-1>
                  <n-icon size="48" :depth="3" i-carbon:encryption> </n-icon>
                </div>
              </n-upload-dragger>
            </n-upload>
          </div>
          <n-button @click="handleConvert" size="large" type="primary" block my-8>
            {{ $t("form.convert.text") }}
          </n-button>
        </n-spin>
        <!-- <n-code :code="logger.join('\n')"></n-code> -->
        <pre>{{ logger.join("\n") }}</pre>
      </div>
    </n-layout-content>
    <n-layout-footer>
      <div text-center p2>
        Video to M3U8 · Made by <a href="https://github.com/KeJunMao">KeJun</a>
      </div>
    </n-layout-footer>
  </n-layout>
</template>
