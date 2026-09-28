// 把浏览器插件目录（extension/）打包成 zip，供商品导入页下载。服务启动时打包一次，插件代码随镜像更新。
// zip 内所有文件放在 pinso-capture/ 文件夹下，解压后直接在 chrome://extensions 中「加载已解压的扩展程序」选这个文件夹。

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const FOLDER = 'pinso-capture';

function files(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.name.startsWith('.')) return [];
    return entry.isDirectory() ? files(path.join(dir, entry.name), rel) : [{ name: rel, data: fs.readFileSync(path.join(dir, entry.name)) }];
  });
}

// 最简 zip：每个文件 deflate 压缩，不含扩展字段；文件名按 UTF-8 标记
export function buildExtensionZip(dir) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files(dir)) {
    const name = Buffer.from(`${FOLDER}/${file.name}`, 'utf8');
    const body = zlib.deflateRawSync(file.data);
    const crc = zlib.crc32(file.data);
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0); // 解压所需版本
    common.writeUInt16LE(0x0800, 2); // 文件名为 UTF-8
    common.writeUInt16LE(8, 4); // deflate
    common.writeUInt32LE(0, 6); // 修改时间、日期
    common.writeUInt32LE(crc, 10);
    common.writeUInt32LE(body.length, 14);
    common.writeUInt32LE(file.data.length, 18);
    common.writeUInt16LE(name.length, 22);
    common.writeUInt16LE(0, 24); // 扩展字段长度

    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), common, name, body]);
    // 中央目录项：签名 + 创建版本 + 与本地头相同的 26 字节 + 注释长度、磁盘号、内部属性、外部属性（均为 0）+ 本地头位置
    const tail = Buffer.alloc(14);
    tail.writeUInt32LE(offset, 10);
    locals.push(local);
    centrals.push(Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02, 20, 0]), common, tail, name]));
    offset += local.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
