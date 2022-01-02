import {Format, KnownVideo, NewVideo} from "./video";

/**
 * This function reads the metadata of a video file.
 *
 * FFMPEG is started here and the output is parsed.
 * There is no FFPROBE included in {@see https://github.com/ffmpegwasm/ffmpeg.wasm},
 * so abuse ffmpeg for that. {@see https://github.com/ffmpegwasm/ffmpeg.wasm/issues/121}
 */
export async function analyzeVideo({file, ffmpeg}: NewVideo): Promise<KnownVideo> {
  const metadata: Partial<Format> = {};
  const strings = [] as string[];
  ffmpeg.setLogger(({message}) => {
    strings.push(message);
    parseMetadata(message, metadata);
  });

  await ffmpeg.run('-hide_banner', '-v', 'info', '-i', file.name);
  ffmpeg.setLogger(() => void 0);

  if (!metadata.container || !metadata.video) {
    throw new Error(`Could not analyze video ${JSON.stringify(metadata)}\n${strings.join("\n")}`);
  }

  return {status: "known", file, ffmpeg, metadata: metadata as Format};
}

export function parseMetadata(message: string, metadata: Partial<Format>) {
  const metadataMatch = message.match(/Duration: (?<duration>\d+:\d+:\d+\.\d+), start: (?<start>[\d.]+), bitrate: (?<bitrate>[\d.]+) kb\/s/);
  if (metadataMatch?.groups) {
    const duration = metadataMatch.groups.duration.split(":").map(parseFloat).reduce((a, b) => a * 60 + b);
    metadata.container = {
      duration: duration,
      start: parseFloat(metadataMatch.groups.start),
      // bitrate: parseFloat(metadataMatch.groups.bitrate),
    };
    return;
  }

  const videoMatch = message.match(/Stream #[^:,]+:[^:,]+: Video: (?<codec>[^(),]+(\(\S+\))?).*, (?<color>yuv.+|rgb.+), (?<width>\d+)x(?<height>\d+).*, (?<bitrate>[\d.]+) kb\/s,.* (?<fps>[\d.]+) fps, (?<tbr>[\d.]+) tbr/);
  if (videoMatch?.groups && metadata.container) {
    metadata.video = {
      original: true,
      codec: videoMatch.groups.codec,
      color: videoMatch.groups.color,
      width: parseFloat(videoMatch.groups.width),
      height: parseFloat(videoMatch.groups.height),
      bitrate: parseFloat(videoMatch.groups.bitrate),
      expectedSize: parseFloat(videoMatch.groups.bitrate) * metadata.container.duration / 8,
      fps: Math.max(parseFloat(videoMatch.groups.fps), parseFloat(videoMatch.groups.tbr)),
    };
    return;
  }

  const audioMatch = message.match(/Stream #[^:,]+:[^:,]+: Audio: (?<codec>[^(),]+(\(\S+\))?).*, (?<sampleRate>\d+) Hz, (?<channelSetup>[^,]+), [^,]+, (?<bitrate>[\d.]+) kb\/s/);
  if (audioMatch?.groups && metadata.container) {
    metadata.audio = {
      original: true,
      codec: audioMatch.groups.codec,
      sampleRate: parseFloat(audioMatch.groups.sampleRate),
      channelSetup: audioMatch.groups.channelSetup,
      bitrate: parseFloat(audioMatch.groups.bitrate),
      expectedSize: parseFloat(audioMatch.groups.bitrate) * metadata.container.duration / 8,
    };
    return;
  }
}
