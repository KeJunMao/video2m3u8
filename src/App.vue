<script lang="ts" setup>
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import JsZip from "jszip";

const logger = ref<string[]>([]);

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
  logger.value.push("[info]: ffmpeg core is loaded!");
});

const inputFile = ref<File>();
const keyinfoFile = ref<File>();

const inputFileName = computed(() => {
  return inputFile.value?.name ?? "";
});

const outputFileNameWithoutExt = computed(() => {
  const name = encodeURIComponent(inputFileName.value).split(".");
  name.pop();
  return name.join(".");
});

const outputTsNameTemplate = computed(() => {
  return outputFileNameWithoutExt.value + "-%d.ts";
});
const outputFileName = computed(() => {
  return outputFileNameWithoutExt.value + ".m3u8";
});

function handleFileInputChange({ target: _target }: Event) {
  const target = _target as HTMLInputElement;
  if (target.files) {
    inputFile.value = target.files[0];
  }
}
function handleKeyinfoInputChange({ target: _target }: Event) {
  const target = _target as HTMLInputElement;
  if (target.files) {
    keyinfoFile.value = target.files[0];
  }
}
async function convert() {
  if (inputFile.value) {
    logger.value.push(`[info]: start convert ${inputFileName}`);
    logger.value.push(
      `[info]: if you wan check more logs, please open console`
    );
    ffmpeg.FS(
      "writeFile",
      inputFileName.value,
      await fetchFile(inputFile.value)
    );
    let keyinfo: string[] = [];

    if (keyinfoFile.value) {
      ffmpeg.FS("writeFile", "keyinfo", await fetchFile(keyinfoFile.value));
      keyinfo = ["-hls_key_info_file", "keyinfo"];
    }
    await ffmpeg.run(
      "-i",
      inputFileName.value,
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
    ffmpeg.FS("unlink", inputFileName.value);
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
    const url = URL.createObjectURL(data);
    const download = document.createElement("a");
    download.href = url;
    download.download = outputFileNameWithoutExt.value + ".zip";
    download.click();
  } else {
    logger.value.push(`[error]: please select video file`);
  }
}
</script>
<template>
  <div>
    <h1>Video To m3u8</h1>
    <div>
      <label for="file">*)Video File: </label>
      <input accept="video/*" @change="handleFileInputChange" type="file" />
    </div>
    <div>
      <label for="file">&nbsp;)Keyinfo File: </label>
      <input accept="text/*" @change="handleKeyinfoInputChange" type="file" />
    </div>
    <button @click="convert">Convert And Download</button>
    <h2>Logs:</h2>
    <pre>
      <code v-for="log in logger">
        {{log}}
      </code>
    </pre>
  </div>
</template>
