import {ConvertedVideo, Format, KnownVideo} from "./video";

/**
 * Starts the converting process.
 *
 */
export async function convertVideo(
  {file, ffmpeg, metadata}: KnownVideo,
  format: Format,
  onProgress: (percent: number) => void,
): Promise<ConvertedVideo> {
  const args: string[] = ['-hide_banner', '-y'];

  // TODO: check what it means if the source video has a start time !== 0
  if (format.container.start > metadata.container.start) {
    args.push('-ss', String(format.container.start));
  }

  if (format.container.duration < metadata.container.duration - format.container.start) {
    args.push('-t', String(format.container.duration));
  }

  args.push('-i', `input ${file.name}`);
  args.push(...videoArguments(metadata, format));
  args.push(...audioArguments(metadata, format));
  args.push('-sn'); // no subtitles
  args.push('-dn'); // no data streams
  args.push('-f', 'mp4'); // use mp4 since it has the best compatibility as long as all streams are supported
  args.push('-movflags', '+faststart'); // moves metadata to the beginning of the mp4 container ~ useful for streaming
  args.push(`output ${file.name}`);

  ffmpeg.setProgress(({ratio}) => {
    onProgress(ratio >= 0 && ratio <= 1 ? ratio * 100 : 0);
  });

  await ffmpeg.run(...args);
  const result = ffmpeg.FS('readFile', `output ${file.name}`);
  ffmpeg.setProgress(() => void 0);

  const newFileName = file.name.replace(/\.\w{2,4}$|$/, ".mp4");
  return {
    status: "converted",
    file: new File([result], newFileName, {type: 'video/mp4'}),
    metadata: format,
  };
}

function videoArguments(metadata: Format, format: Format) {
  const args: string[] = [];

  if (!format.video || format.video.codec === 'none') {
    args.push('-vn');
    return args;
  }

  args.push('-pix_fmt:v', format.video.color);
  args.push('-sws_flags', 'bilinear');

  if (format.video.width !== metadata.video.width || format.video.height !== metadata.video.height) {
    args.push('-s:v', `${format.video.width}x${format.video.height}`);
  }

  if (metadata.video.fps > format.video.fps) {
    args.push('-r:v', format.video.fps.toString());
  }

  if (format.video.codec.startsWith('h264')) {
    args.push('-c:v', 'libx264');
    args.push('-preset:v', 'fast');
    // args.push('-level:v', '4.0'); // https://en.wikipedia.org/wiki/Advanced_Video_Coding#Levels
    args.push('-profile:v', 'high');

    if (format.video.crf) {
      args.push('-crf:v', format.video.crf.toString());
    } else if (format.video.bitrate) {
      args.push('-b:v', `${format.video.bitrate}k`);
    } else {
      throw new Error("No video bitrate or crf specified");
    }
  } else {
    throw new Error(`Unsupported video codec: ${format.video.codec}`);
  }

  return args;
}

function audioArguments(metadata: Format, format: Format) {
  const args: string[] = [];

  if (!format.audio || format.audio.codec === 'none') {
    args.push('-an');
    return args;
  }

  args.push('-ar', format.audio.sampleRate.toString());

  if (format.audio.codec.startsWith('aac')) {
    args.push('-c:a', 'libfdk_aac');
    args.push('-b:a', `${format.audio.bitrate}k`);
    args.push('-ac', '2'); // always force stereo (mono untested)
    args.push('-strict', '-2');
    if (format.audio.channelSetup === 'stereo' && format.audio.bitrate <= 48) {
      args.push('-profile:a', 'aac_he_v2');
    } else if (format.audio.channelSetup === 'mono' && format.audio.bitrate <= 48 || format.audio.bitrate <= 72) {
      args.push('-profile:a', 'aac_he');
    }
  } else {
    throw new Error(`Unsupported audio codec: ${format.audio.codec}`);
  }

  return args;
}