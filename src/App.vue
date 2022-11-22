<script lang="ts" setup>
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import JsZip from "jszip";
import { OnUpdateFileList } from "naive-ui/es/upload/src/interface";

const logger = ref<string[]>([]);
const loading = ref(false);

logger.value.push("[info]: create ffmpeg");
const ffmpeg = createFFmpeg({
  log: true,
  logger: (log) => {
    console.log(log);
    logger.value.push(`[${log.type}] - ${log.message}`);
  },
  progress: (p) => {
    console.log(p);
    logger.value.push(`[progress] - ${p.ratio * 100}%`);
  },
});
onMounted(async () => {
  logger.value.push("[info]: load ffmpeg core, please wait...");
  await ffmpeg.load();
  logger.value.push("[success]: ffmpeg core is loaded!");
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
  return encodeURIComponent(outputFileNameWithoutExt.value) + "-%d.ts";
});
const outputFileName = computed(() => {
  return outputFileNameWithoutExt.value + ".m3u8";
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
    logger.value.push("[info] - key URI is empty, ignore encrypt");
    return;
  }
  if (!keyFile.value) {
    logger.value.push("[info] - key File is empty, ignore encrypt");
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
    logger.value.push(`[info]: start convert ${sourceVideoName.value}`);
    logger.value.push(
      `[info]: if you wan check more logs, please open console`
    );
    ffmpeg.FS(
      "writeFile",
      sourceVideoName.value,
      await fetchFile(sourceVideoFile.value)
    );
    let keyinfo: string[] = [];
    const keyinfoFile = tryCreateKeyInfoFile();

    if (keyinfoFile && keyFile.value) {
      ffmpeg.FS(
        "writeFile",
        keyFile.value.name,
        await fetchFile(keyFile.value)
      );
      ffmpeg.FS("writeFile", "keyinfo", await fetchFile(keyinfoFile));
      keyinfo = ["-hls_key_info_file", "keyinfo"];
    }
    await ffmpeg.run(
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
    );
    ffmpeg.FS("unlink", sourceVideoName.value);
    ffmpeg.FS("unlink", "keyinfo");
    ffmpeg.FS("unlink", keyFile.value?.name as string);
    const zip = new JsZip();
    const dir = ffmpeg.FS("readdir", ".");
    let isFail = true;

    for (let file of dir) {
      if (file.endsWith(".ts") || file.endsWith(".m3u8")) {
        isFail = false;
        const data = ffmpeg.FS("readFile", file);
        zip.file(file, data);
        ffmpeg.FS("unlink", file);
      }
    }
    if (isFail) {
      logger.value.push("[error]: please open console to check detail logs");
      return;
    }
    const data = await zip.generateAsync({ type: "blob" });
    downloadFile(data, outputFileNameWithoutExt.value + ".zip");
  } else {
    logger.value.push(`[error]: please select video file`);
  }
  loading.value = false;
}
</script>
<template>
  <n-layout>
    <n-layout-header>
      <n-page-header p-4>
        <template #title> Video to M3U8 </template>
        <template #avatar>
          <n-icon i-carbon:document-video text-2xl />
        </template>
      </n-page-header>
    </n-layout-header>
    <n-layout-content content-style="padding: 24px;">
      <n-spin :show="loading">
        <div container m-auto>
          <div>
            <h2>Video File <span color-red>*</span></h2>
            <n-upload
              directory-dnd
              accept="video/*"
              :max="1"
              :on-update:file-list="onVideoFileUpdate"
            >
              <n-upload-dragger>
                <div mb-1>
                  <n-icon size="48" :depth="3" i-carbon:video> </n-icon>
                </div>
                <n-text> Click or drag the file to this area to upload </n-text>
              </n-upload-dragger>
            </n-upload>
          </div>
          <div>
            <h2>Encryption (optional)</h2>
            <n-grid :cols="2" x-gap="24">
              <n-gi>
                <h3>Key URI <span color-red>*</span></h3>
                <n-input
                  v-model:value="keyURI"
                  type="text"
                  placeholder="Key URI"
                />
              </n-gi>
              <n-gi>
                <h3>IV</h3>
                <n-input v-model:value="keyIV" type="text" placeholder="IV" />
              </n-gi>
            </n-grid>
            <h3>Key File <span color-red>*</span></h3>
            <n-upload
              directory-dnd
              :max="1"
              :on-update:file-list="onKeyFileUpdate"
            >
              <n-upload-dragger>
                <div mb-1>
                  <n-icon size="48" :depth="3" i-carbon:encryption> </n-icon>
                </div>
              </n-upload-dragger>
            </n-upload>
          </div>
          <n-button
            @click="handleConvert"
            size="large"
            type="primary"
            block
            my-8
          >
            Convert And Download
          </n-button>
          <n-code :code="logger.join('\n')"></n-code>
        </div>
      </n-spin>
    </n-layout-content>
    <n-layout-footer>
      <div text-center p2>Video to M3U8 · Made by KeJun</div>
    </n-layout-footer>
  </n-layout>
</template>
