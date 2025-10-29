declare module "ytdl-core" {
  import type { Readable } from "stream";
  import type { RequestOptions as HttpsRequestOptions } from "https";

  export type YTDLFilter =
    | "audioonly"
    | "videoonly"
    | "audioandvideo"
    | ((format: unknown) => boolean);

  export type YTDLQuality =
    | "highestaudio"
    | "lowestaudio"
    | "highest"
    | "lowest"
    | number
    | string;

  export interface YTDLDownloadOptions {
    filter?: YTDLFilter;
    quality?: YTDLQuality;
    highWaterMark?: number;
    dlChunkSize?: number; // 0 허용
    liveBuffer?: number;
    requestOptions?: HttpsRequestOptions;
  }

  export default function ytdl(
    url: string,
    options?: YTDLDownloadOptions
  ): Readable;
}
