import { Context, h, Schema, Session, Element } from "koishi";

export const name = "mm-mj-d";
export const inject = ["database"];
export const usage = `## **使用**

1. 设置指令别名（若没看到指令，请重启 commands 插件）。
2. 注册 [钱多多 API](https://api.ifopen.ai/) ([>>>带邀请码的注册链接<<<](https://api2.aigcbest.top/register?aff=FDQw)) 并配置。
3. 使用 \`mmd.绘图\` 指令进行绘图，如：\`mmd.绘图 a dog\`。
4. 后续操作：引用回复消息，并输入 \` 1 \` 、\` 2 \` 、\` 3 \` 、\` 4 \` ... (注意！所有数字前后都需有空格)。
    - 引用回复 \`seed\` 或 \`种子\` 获取图片种子。
5. 混合图片参数 (可选): \`-p\` (竖图 2:3), \`-s\` (方图 1:1), \`-l\` (横图 3:2, 默认)。
    - 例：\`mmd.混合 -l [这里放 2一5 张图片或者 @ 多名群成员]\`。

## **特性**

- OneBot 适配器，可在提示词中通过 @ 成员获取头像。

## QQ 群

- 956758505`;

// pz*
export interface Config {
  baseURL: string;
  uploadURL: string;
  apiKey: string;

  atReply: boolean;
  quoteReply: boolean;

  isLog: boolean;
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    baseURL: Schema.string()
      .default("https://api2.aigcbest.top")
      .description("https://api2.aigcbest.top, https://us.ifopen.ai"),
    uploadURL: Schema.string()
      .default("https://c-z0-api-01.hash070.com")
      .description(
        "https://c-z0-api-01.hash070.com, https://apic.ohmygpt.com, https://api.ohmygpt.com"
      ),
    apiKey: Schema.string(),
  }).description("API"),

  Schema.object({
    atReply: Schema.boolean().default(false).description("响应时 @"),
    quoteReply: Schema.boolean().default(true).description("响应时引用"),
  }).description("回复"),

  Schema.object({
    isLog: Schema.boolean().default(false).description("是否记录"),
  }).description("日志"),
]);

// smb*
declare module "koishi" {
  interface Tables {
    mm_mj: MJ;
  }
}

// jk*
interface MJ {
  id: number;
  msgId: string;
  taskId: string;
  buttons: any;
}

export async function apply(ctx: Context, cfg: Config) {
  // tzb*
  ctx.model.extend(
    "mm_mj",
    {
      id: "unsigned",
      msgId: "string",
      taskId: "string",
      buttons: "json",
    },
    { autoInc: true, primary: "id" }
  );

  // cl*
  const logger = ctx.logger("mm-mj-d");
  const ini_mjs = await ctx.database.get("mm_mj", {});

  let msgIds = ini_mjs.map((mj) => mj.msgId);

  // zjj*
  ctx.middleware(async (session, next) => {
    if (!session.quote) {
      return await next();
    }
    const quoteId = session.quote.id;
    if (!msgIds.includes(session.quote.id)) {
      return await next();
    }

    const mjs = await ctx.database.get("mm_mj", { msgId: quoteId });
    if (mjs.length === 0) {
      return await next();
    }
    const mj = mjs[0];
    const content = `${h.select(session.elements, "text")}`;

    let isExecuted = false;

    if (content.includes("seed") || content.includes("种子")) {
      const seed = await getSeed(mj.taskId);
      if (seed) {
        await sendMsg(session, seed);
      } else {
        await sendMsg(session, "种子获取失败");
      }
      isExecuted = true;
    }

    for (const [index, element] of mj.buttons.entries()) {
      if (content.includes(` ${index + 1} `)) {
        const result = await submitAction(
          mj.taskId.toString(),
          element.customId
        );
        if (cfg.isLog) {
          logger.info(result);
        }
        if (!result.success) {
          continue;
        }
        const queryResult = await executeMidjourneyTask(
          result.data.result.toString()
        );
        if (!queryResult.success) {
          continue;
        }
        const msgId = await sendMsg(
          session,
          `${h.image(queryResult.data.imageUrl)}\n${formatTaskActions(
            queryResult.data.buttons
          )}`,
          true
        );
        await ctx.database.create("mm_mj", {
          msgId: msgId,
          taskId: result.data.result.toString(),
          buttons: queryResult.data.buttons,
        });
        msgIds.push(msgId);
        isExecuted = true;
      }
    }

    if (!isExecuted) {
      return await next();
    }
  }, true);

  // zl*
  ctx.command("mmd", "midjourney");

  // ht*
  ctx
    .command("mmd.绘图 <prompt:text>", { captureQuote: false })
    .action(async ({ session }, prompt) => {
      console.log(session.elements);
      let headImgUrls = [];
      if (session.platform === "onebot" || session.platform === "red") {
        headImgUrls = getHeadImgUrls(h.select(prompt, "at"));
      }

      prompt = `${h.select(prompt, "text")}`;

      if (!prompt && session.quote) {
        prompt = `${h.select(session.quote.elements, "text")}`;
      }
      if (!prompt) {
        return sendMsg(
          session,
          `缺少提示词

指令：mmd.绘图 提示词

示例：mmd.绘图 a dog`
        );
      }

      const quoteImgUrls = extractImageSources(session.quote?.elements || []);
      const promptImgUrls = extractImageSources(session.elements);
      const retrieveIds = await uploadImagesAndRetrieveIds([
        ...headImgUrls,
        ...quoteImgUrls,
        ...promptImgUrls,
      ]);
      const uploadedImgUrls = retrieveIds.map(
        (id) => `https://pi.ohmygpt.com/api/v1/f/pub/${id}`
      );

      prompt = `${uploadedImgUrls.join(" ")} ${prompt}`;
      console.log(prompt);
      return;
      const result = await submitImagine(prompt);
      if (cfg.isLog) {
        logger.info(result);
        logger.info(`Prompt: ${prompt}`);
      }

      if (!result.success) {
        return sendMsg(session, `绘图失败: ${result.message}`);
      }

      if (result.data.code !== 1) {
        return sendMsg(session, `绘图失败: ${result.data.description}`);
      }

      const taskId = result.data.result.toString();
      const queryResult = await executeMidjourneyTask(taskId);
      if (!queryResult.success) {
        return sendMsg(session, `绘图失败: ${queryResult.message}`);
      }

      const msgId = await sendMsg(
        session,
        `${h.image(queryResult.data.imageUrl)}\n${formatTaskActions(
          queryResult.data.buttons
        )}`,
        true
      );

      await ctx.database.create("mm_mj", {
        msgId: msgId,
        taskId,
        buttons: queryResult.data.buttons,
      });

      msgIds.push(msgId);
    });

  // hh*
  ctx
    .command("mmd.混合 <prompt:text>", "2一5 张图", { captureQuote: false })
    .option("portrait", "-p")
    .option("square", "-s")
    .option("landscape", "-l")
    .action(async ({ session, options }, prompt) => {
      let headImgUrls = [];
      if (session.platform === "onebot" || session.platform === "red") {
        headImgUrls = getHeadImgUrls(h.select(prompt, "at"));
      }
      prompt = `${h.select(prompt, "text")}`;

      if (!prompt && session.quote) {
        prompt = `${h.select(session.quote.elements, "text")}`;
      }

      const promptLinks = extractLinksInPrompts(prompt);
      const quoteImgUrls = extractImageSources(session.quote?.elements || []);
      const promptImgUrls = extractImageSources(session.elements);
      const allImgUrls = [
        ...promptLinks,
        ...headImgUrls,
        ...promptImgUrls,
        ...quoteImgUrls,
      ];

      if (allImgUrls.length < 2 || allImgUrls.length > 5) {
        return sendMsg(session, `需要 2一5 张图片`);
      }

      const base64Array = await convertImageUrlsToBase64(allImgUrls);

      let dimensions = "LANDSCAPE";
      if (options.portrait) {
        dimensions = "PORTRAIT";
      } else if (options.square) {
        dimensions = "SQUARE";
      }

      const result = await submitBlend(base64Array, dimensions);
      if (cfg.isLog) {
        logger.info(result);
        logger.info(`Blend: ${allImgUrls.join(" ")}`);
      }

      if (!result.success) {
        return sendMsg(session, `绘图失败: ${result.message}`);
      }
      const taskId = result.data.result.toString();
      const queryResult = await executeMidjourneyTask(taskId);
      if (!queryResult.success) {
        return sendMsg(session, `绘图失败: ${queryResult.message}`);
      }

      const msgId = await sendMsg(
        session,
        `${h.image(queryResult.data.imageUrl)}\n${formatTaskActions(
          queryResult.data.buttons
        )}`,
        true
      );

      await ctx.database.create("mm_mj", {
        msgId: msgId,
        taskId,
        buttons: queryResult.data.buttons,
      });

      msgIds.push(msgId);
    });

  // scsyjl*
  ctx
    .command("mmd.删除所有记录", { authority: 2 })
    .action(async ({ session }, prompt) => {
      await ctx.database.remove("mm_mj", {});
      msgIds = [];
      await sendMsg(session, `已删除所有记录`);
    });

  // hs*
  async function submitAction(taskId: string, customId: string) {
    const data = JSON.stringify({
      chooseSameChannel: true,
      customId: customId,
      taskId: taskId,
      accountFilter: {
        channelId: "",
        instanceId: "",
        modes: [],
        remark: "",
        remix: true,
        remixAutoConsidered: true,
      },
      notifyHook: "",
      state: "",
    });

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: data,
    };

    try {
      const response = await fetch(
        `${removeTrailingSlash(cfg.baseURL)}/mj/submit/action`,
        requestOptions
      );

      if (response.ok) {
        try {
          const parsedResult = await response.json();
          return { success: true, data: parsedResult };
        } catch (jsonError) {
          return {
            success: false,
            statusCode: response.status,
            message: `JSON parsing error: ${jsonError.message}`,
          };
        }
      } else {
        return {
          success: false,
          statusCode: response.status,
          message: response.statusText || "Unknown error",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        statusCode: 0,
        message: error.message || "Network error",
      };
    }
  }

  async function submitBlend(
    base64Array: string[],
    dimensions: string
  ): Promise<any> {
    const data = JSON.stringify({
      botType: "MID_JOURNEY",
      base64Array: base64Array,
      dimensions: dimensions,
      accountFilter: {
        channelId: "",
        instanceId: "",
        modes: [],
        remark: "",
        remix: true,
        remixAutoConsidered: true,
      },
      notifyHook: "",
      state: "",
    });

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: data,
    };

    try {
      const response = await fetch(
        `${removeTrailingSlash(cfg.baseURL)}/mj/submit/blend`,
        requestOptions
      );

      if (response.ok) {
        try {
          const parsedResult = await response.json();
          return { success: true, data: parsedResult };
        } catch (jsonError) {
          return {
            success: false,
            statusCode: response.status,
            message: `JSON parsing error: ${jsonError.message}`,
          };
        }
      } else {
        return {
          success: false,
          statusCode: response.status,
          message: response.statusText || "Unknown error",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        statusCode: 0,
        message: error.message || "Network error",
      };
    }
  }

  async function convertImageUrlToBase64(imgUrl: string): Promise<string> {
    try {
      const response = await fetch(imgUrl);
      if (!response.ok) {
        logger.error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
        return "";
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64String = buffer.toString("base64");

      return `data:image/webp;base64,${base64String}`;
    } catch (error) {
      logger.error(`Error processing image ${imgUrl}:`, error);
      return "";
    }
  }

  async function convertImageUrlsToBase64(
    allImgUrls: string[]
  ): Promise<string[]> {
    const promises = allImgUrls.map(convertImageUrlToBase64);
    const results = await Promise.all(promises);
    return results.filter((result) => result !== "");
  }

  function extractLinksInPrompts(prompt: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return prompt.match(urlRegex) || [];
  }

  function formatTaskActions(buttons): string {
    const formattedLines = buttons.map((button, index) => {
      const serialNumber = index + 1;
      return `${serialNumber} ${button.emoji}${button.label}`;
    });

    return formattedLines.join("\n");
  }

  async function executeMidjourneyTask(taskId: string): Promise<any> {
    return new Promise((resolve) => {
      const intervalId = setInterval(async () => {
        const queryResult = await getMidjourneyTask(taskId);
        if (cfg.isLog) {
          logger.info(queryResult);
        }

        if (!queryResult.success) {
          clearInterval(intervalId);
          resolve(queryResult);
          return;
        }

        const failReason = queryResult.data.failReason;
        if (failReason) {
          clearInterval(intervalId);
          resolve({
            success: false,
            statusCode: queryResult.data.status,
            message: failReason,
          });
          return;
        }

        if (queryResult.data.status === "SUCCESS") {
          clearInterval(intervalId);
          resolve(queryResult);
          return;
        }

        if (queryResult.data.status === "FAILURE") {
          clearInterval(intervalId);
          resolve({
            success: false,
            statusCode: "FAILURE",
            message: failReason || "Midjourney task failed.",
          });
          return;
        }
      }, 5000);
    });
  }

  async function getMidjourneyTask(taskId: string) {
    const fetchOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
    };

    try {
      const API_URL = `${removeTrailingSlash(
        cfg.baseURL
      )}/mj/task/${taskId}/fetch`;
      const response = await fetch(API_URL, fetchOptions);

      if (response.ok) {
        const taskData = await response.json();
        return { success: true, data: taskData };
      } else {
        return {
          success: false,
          statusCode: response.status,
          message: `Request failed with status: ${response.status}`,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        statusCode: 0,
        message: `Network error: ${message}`,
      };
    }
  }

  function removeTrailingSlash(baseURL: string): string {
    baseURL = baseURL.trim();

    if (baseURL.endsWith("/")) {
      return baseURL.slice(0, -1);
    } else {
      return baseURL;
    }
  }

  async function submitImagine(prompt: string) {
    const data = JSON.stringify({
      botType: "MID_JOURNEY",
      prompt: prompt,
      base64Array: [],
      accountFilter: {
        channelId: "",
        instanceId: "",
        modes: [],
        remark: "",
        remix: true,
        remixAutoConsidered: true,
      },
      notifyHook: "",
      state: "",
    });

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: data,
    };

    try {
      const response = await fetch(
        `${removeTrailingSlash(cfg.baseURL)}/mj/submit/imagine`,
        requestOptions
      );

      if (response.ok) {
        try {
          const parsedResult = await response.json();
          return { success: true, data: parsedResult };
        } catch (jsonError) {
          return {
            success: false,
            statusCode: response.status,
            message: `JSON parsing error: ${jsonError.message}`,
          };
        }
      } else {
        return {
          success: false,
          statusCode: response.status,
          message: response.statusText || "Unknown error",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        statusCode: 0,
        message: error.message || "Network error",
      };
    }
  }

  async function uploadImagesAndRetrieveIds(
    imgUrls: string[]
  ): Promise<string[]> {
    const fileUniqueIDs: string[] = [];

    for (const imgUrl of imgUrls) {
      const imageResponse = await fetch(imgUrl);
      if (!imageResponse.ok) {
        logger.error(
          `Failed to fetch image from ${imgUrl}: ${imageResponse.status} ${imageResponse.statusText}`
        );
        return [];
      }
      const imageBlob = await imageResponse.blob();

      const url = new URL(imgUrl);
      const pathname = url.pathname;
      const filename = pathname.substring(pathname.lastIndexOf("/") + 1);

      const formData = new FormData();
      formData.append("file", imageBlob, filename);
      formData.append("filename", filename);
      formData.append("purpose", "3");
      formData.append("is_public", "true");

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 1000);
      const expiresAtISOString = expiresAt.toISOString();
      formData.append("expires_at", expiresAtISOString);

      const uploadResponse = await fetch(
        `${removeTrailingSlash(cfg.uploadURL)}/api/v1/user/files/upload`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer sk-9QOOGfuH4368CbcFf6F2T3BlBkFJ510a50f8B27E4dF79D81`,
          },
          redirect: "follow",
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        logger.error(
          `File upload failed for ${filename}: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`
        );
        return [];
      }

      const responseData = await uploadResponse.json();

      if (responseData && responseData.data && responseData.data.fileUniqueID) {
        fileUniqueIDs.push(responseData.data.fileUniqueID);
      } else {
        logger.error(
          `Invalid response from file upload API for ${filename}: ${JSON.stringify(
            responseData
          )}`
        );
        return [];
      }
    }

    return fileUniqueIDs;
  }

  function extractImageSources(elements: Element[]): string[] {
    return elements.flatMap((element) => {
      const sources: string[] = [];
      if (element.attrs && element.attrs.src) {
        sources.push(element.attrs.src);
      }
      if (element.children && element.children.length > 0) {
        sources.push(...extractImageSources(element.children));
      }
      return sources;
    });
  }

  function getHeadImgUrls(atElements: Element[]): string[] {
    return atElements.map((element) => {
      const atId = element.attrs.id;
      return `https://q.qlogo.cn/headimg_dl?dst_uin=${atId}&spec=640`;
    });
  }

  async function getSeed(taskId: string): Promise<string | null> {
    const url = `${removeTrailingSlash(
      cfg.baseURL
    )}/mj/task/${taskId}/image-seed`;
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    };

    try {
      const response = await fetch(url, { headers });
      if (response.ok) {
        const { result } = await response.json();
        return result;
      } else {
        return null;
      }
    } catch (error) {
      logger.error("Error get seed:", error);
      return null;
    }
  }

  async function sendMsg(session: Session, msg: any, isReturnMsgId = false) {
    if (cfg.atReply) {
      msg = `${h.at(session.userId)}${h("p", "")}${msg}`;
    }

    if (cfg.quoteReply) {
      msg = `${h.quote(session.messageId)}${msg}`;
    }

    const [msgId] = await session.send(msg);
    if (isReturnMsgId) {
      return msgId;
    }
  }
}
