# koishi-plugin-mm-mj-d

[<img alt="github" src="https://img.shields.io/badge/github-araea/mm_mj_d-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-mm-mj-d)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-mm-mj-d.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-mm-mj-d)

Koishi 的 Midjourney AI 绘图插件（[钱多多 API](https://api.ifopen.ai/)）。

## **使用**

1. 设置指令别名（若没看到指令，请重启 commands 插件）。
2. 注册 [钱多多 API](https://api.ifopen.ai/) ([>>>带邀请码的注册链接<<<](https://api2.aigcbest.top/register?aff=FDQw)) 并配置。
3. 使用 `mmd.绘图` 指令进行绘图，如：`mmd.绘图 a dog`。
4. 后续操作：引用回复消息，并输入 ` 1 ` 、` 2 ` 、` 3 ` 、` 4 ` ... (注意！所有数字前后都需有空格)。
   - 引用回复 `seed` 或 `种子` 获取图片种子。
5. 混合图片参数 (可选): `-p` (竖图 2:3), `-s` (方图 1:1), `-l` (横图 3:2, 默认)。
   - 例：`mmd.混合 -l [这里放 2一5 张图片或者 @ 多名群成员]`。

## **特性**

- OneBot 适配器，可在提示词中通过 @ 成员获取头像。

## 致谢

- [Koishi](https://koishi.chat/)
- [钱多多 API](https://api.ifopen.ai/)
- [Midjourney AI](https://midjourney.com/)

## QQ 群

- 956758505

<br>

#### License

<sup>
Licensed under either of <a href="../omg-mj-d/LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="../omg-mj-d/LICENSE-MIT">MIT license</a> at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>
