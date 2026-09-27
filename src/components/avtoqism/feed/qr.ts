/**
 * A QR code, computed here.
 *
 * The share sheet has to show a scannable code for a link. Reaching for an
 * image service would send every share — and the viewer's address — to a third
 * party, and a dependency for eight hundred lines of matrix maths is a
 * dependency to keep patched. The encoder is small enough to own: byte mode,
 * automatic version, the standard mask search.
 *
 * Only what the share sheet needs is implemented — byte mode and one segment.
 * Numeric and alphanumeric modes would pack a link more tightly, but a link is
 * not numeric and the version that results is already well under the limit.
 */

export type Ecl = "L" | "M" | "Q" | "H";

/** How the four levels are written into the format information field. */
const ECL_FORMAT_BITS: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };

/**
 * Error-correction codewords per block, and the number of blocks, indexed by
 * version. Index 0 is unused so a version reads as itself. These are the
 * tables from ISO/IEC 18004 and there is no way to derive them.
 */
const ECC_CODEWORDS_PER_BLOCK: Record<Ecl, number[]> = {
  L: [
    0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30,
    30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  M: [
    0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  Q: [
    0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30,
    30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  H: [
    0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
};

const NUM_BLOCKS: Record<Ecl, number[]> = {
  L: [
    0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14,
    15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ],
  M: [
    0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25,
    26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  Q: [
    0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34,
    34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  H: [
    0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37,
    40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
};

const MIN_VERSION = 1;
const MAX_VERSION = 40;

/* --- sizing ---------------------------------------------------------------- */

/** Every module of the symbol that is not a function pattern, in bits. */
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewordCount(version: number, ecl: Ecl): number {
  const perBlock = ECC_CODEWORDS_PER_BLOCK[ecl][version] ?? 0;
  const blocks = NUM_BLOCKS[ecl][version] ?? 1;
  return Math.floor(rawDataModules(version) / 8) - perBlock * blocks;
}

/** Byte mode spends 8 bits on the character count up to version 9, then 16. */
function charCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

function pickVersion(byteLength: number, ecl: Ecl): number {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    const capacityBits = dataCodewordCount(version, ecl) * 8;
    const neededBits = 4 + charCountBits(version) + byteLength * 8;
    if (neededBits <= capacityBits) return version;
  }
  throw new RangeError("QR: matn juda uzun.");
}

/* --- data encoding ---------------------------------------------------------- */

function encodeData(data: Uint8Array, version: number, ecl: Ecl): number[] {
  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(data.length, charCountBits(version));
  for (const byte of data) push(byte, 8);

  const capacityBits = dataCodewordCount(version, ecl) * 8;
  push(0, Math.min(4, capacityBits - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] ?? 0);
    codewords.push(byte);
  }
  // The two pad codewords the standard names, alternating to the end.
  for (let pad = 0xec; codewords.length < capacityBits / 8; pad ^= 0xec ^ 0x11) {
    codewords.push(pad);
  }
  return codewords;
}

/* --- Reed-Solomon ----------------------------------------------------------- */

/** Multiplication in GF(2^8) with the QR field generator 0x11D. */
function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsGenerator(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j] ?? 0, root) ^ (result[j + 1] ?? 0);
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], generator: number[]): number[] {
  const result = new Array<number>(generator.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    for (let i = 0; i < generator.length; i++) {
      result[i] = (result[i] ?? 0) ^ gfMultiply(generator[i] ?? 0, factor);
    }
  }
  return result;
}

/** Split into blocks, append each block's ECC, then interleave as the standard says. */
function addEccAndInterleave(data: number[], version: number, ecl: Ecl): number[] {
  const blockCount = NUM_BLOCKS[ecl][version] ?? 1;
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[ecl][version] ?? 0;
  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlockCount = blockCount - (totalCodewords % blockCount);
  const shortBlockLength = Math.floor(totalCodewords / blockCount);

  const generator = rsGenerator(eccPerBlock);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const length = shortBlockLength - eccPerBlock + (i < shortBlockCount ? 0 : 1);
    const chunk = data.slice(k, k + length);
    k += length;
    const ecc = rsRemainder(chunk, generator);
    // A short block is padded to the long blocks' length so the interleave is
    // one rectangular walk; the placeholder is skipped again below.
    const block = i < shortBlockCount ? chunk.concat([0]) : chunk;
    blocks.push(block.concat(ecc));
  }

  const result: number[] = [];
  const blockLength = shortBlockLength + 1;
  for (let i = 0; i < blockLength; i++) {
    for (let j = 0; j < blocks.length; j++) {
      // The placeholder sits exactly at the boundary between data and ECC.
      if (i === shortBlockLength - eccPerBlock && j < shortBlockCount) continue;
      const value = blocks[j]?.[i];
      if (value !== undefined) result.push(value);
    }
  }
  return result;
}

/* --- the symbol -------------------------------------------------------------- */

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

class Symbol_ {
  readonly size: number;
  readonly modules: boolean[][];
  readonly reserved: boolean[][];

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
    this.reserved = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
  }

  get(x: number, y: number): boolean {
    return this.modules[y]?.[x] ?? false;
  }

  set(x: number, y: number, dark: boolean, functional: boolean) {
    const row = this.modules[y];
    const mask = this.reserved[y];
    if (!row || !mask) return;
    row[x] = dark;
    if (functional) mask[x] = true;
  }
}

function drawFinder(symbol: Symbol_, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= symbol.size || y >= symbol.size) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      symbol.set(x, y, distance !== 2 && distance !== 4, true);
    }
  }
}

function drawAlignment(symbol: Symbol_, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      symbol.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, true);
    }
  }
}

function drawFunctionPatterns(symbol: Symbol_) {
  const n = symbol.size;

  for (let i = 0; i < n; i++) {
    symbol.set(6, i, i % 2 === 0, true);
    symbol.set(i, 6, i % 2 === 0, true);
  }

  drawFinder(symbol, 3, 3);
  drawFinder(symbol, n - 4, 3);
  drawFinder(symbol, 3, n - 4);

  const positions = alignmentPositions(symbol.version);
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      // The three corners already carry a finder pattern.
      const corner =
        (i === 0 && j === 0) ||
        (i === 0 && j === positions.length - 1) ||
        (i === positions.length - 1 && j === 0);
      if (corner) continue;
      drawAlignment(symbol, positions[i] ?? 0, positions[j] ?? 0);
    }
  }

  symbol.set(8, n - 8, true, true); // the always-dark module
  if (symbol.version >= 7) drawVersionInformation(symbol);

  // Reserving the format field means writing it: the positions skip the timing
  // column, so a plain rectangle of reservations would erase two timing modules.
  // The real contents are written again once the mask is chosen.
  drawFormatBits(symbol, "L", 0);
}

function drawVersionInformation(symbol: Symbol_) {
  let rem = symbol.version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = ((symbol.version << 12) | rem) >>> 0;
  const n = symbol.size;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = n - 11 + (i % 3);
    const b = Math.floor(i / 3);
    symbol.set(a, b, dark, true);
    symbol.set(b, a, dark, true);
  }
}

function drawFormatBits(symbol: Symbol_, ecl: Ecl, mask: number) {
  const value = (ECL_FORMAT_BITS[ecl] << 3) | mask;
  let rem = value;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = (((value << 10) | rem) ^ 0x5412) >>> 0;
  const n = symbol.size;

  for (let i = 0; i <= 5; i++) symbol.set(8, i, ((bits >>> i) & 1) !== 0, true);
  symbol.set(8, 7, ((bits >>> 6) & 1) !== 0, true);
  symbol.set(8, 8, ((bits >>> 7) & 1) !== 0, true);
  symbol.set(7, 8, ((bits >>> 8) & 1) !== 0, true);
  for (let i = 9; i < 15; i++) symbol.set(14 - i, 8, ((bits >>> i) & 1) !== 0, true);

  for (let i = 0; i < 8; i++) symbol.set(n - 1 - i, 8, ((bits >>> i) & 1) !== 0, true);
  for (let i = 8; i < 15; i++) symbol.set(8, n - 15 + i, ((bits >>> i) & 1) !== 0, true);
}

function drawCodewords(symbol: Symbol_, codewords: number[]) {
  const n = symbol.size;
  let bit = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing pattern is not a data column
    for (let vert = 0; vert < n; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (symbol.reserved[y]?.[x]) continue;
        const byte = codewords[bit >>> 3] ?? 0;
        symbol.set(x, y, ((byte >>> (7 - (bit & 7))) & 1) !== 0, false);
        bit++;
      }
    }
  }
}

function applyMask(symbol: Symbol_, mask: number) {
  for (let y = 0; y < symbol.size; y++) {
    for (let x = 0; x < symbol.size; x++) {
      if (symbol.reserved[y]?.[x]) continue;
      let invert: boolean;
      switch (mask) {
        case 0:
          invert = (x + y) % 2 === 0;
          break;
        case 1:
          invert = y % 2 === 0;
          break;
        case 2:
          invert = x % 3 === 0;
          break;
        case 3:
          invert = (x + y) % 3 === 0;
          break;
        case 4:
          invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
          break;
        case 5:
          invert = ((x * y) % 2) + ((x * y) % 3) === 0;
          break;
        case 6:
          invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
          break;
        default:
          invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
          break;
      }
      const row = symbol.modules[y];
      if (row && invert) row[x] = !row[x];
    }
  }
}

/** The four penalty rules, which is how a mask is chosen. */
function penalty(symbol: Symbol_): number {
  const n = symbol.size;
  let score = 0;

  const runScore = (runLength: number) => (runLength >= 5 ? runLength - 2 : 0);

  for (let y = 0; y < n; y++) {
    let run = 0;
    let previous = false;
    for (let x = 0; x < n; x++) {
      const dark = symbol.get(x, y);
      if (x > 0 && dark === previous) run++;
      else {
        score += runScore(run);
        run = 1;
      }
      previous = dark;
    }
    score += runScore(run);
  }
  for (let x = 0; x < n; x++) {
    let run = 0;
    let previous = false;
    for (let y = 0; y < n; y++) {
      const dark = symbol.get(x, y);
      if (y > 0 && dark === previous) run++;
      else {
        score += runScore(run);
        run = 1;
      }
      previous = dark;
    }
    score += runScore(run);
  }

  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = symbol.get(x, y);
      if (
        a === symbol.get(x + 1, y) &&
        a === symbol.get(x, y + 1) &&
        a === symbol.get(x + 1, y + 1)
      )
        score += 3;
    }
  }

  const pattern = [true, false, true, true, true, false, true];
  const matches = (cells: boolean[], start: number) =>
    pattern.every((want, i) => cells[start + i] === want);
  const lightRun = (cells: boolean[], from: number, to: number) => {
    for (let i = from; i < to; i++) if (cells[i] !== false) return false;
    return true;
  };
  const scanFinderLike = (cells: boolean[]) => {
    for (let i = 0; i + 7 <= cells.length; i++) {
      if (!matches(cells, i)) continue;
      const before = i - 4 >= 0 && lightRun(cells, i - 4, i);
      const after = i + 11 <= cells.length && lightRun(cells, i + 7, i + 11);
      if (before || after || i < 4 || i + 11 > cells.length) score += 40;
    }
  };
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < n; x++) row.push(symbol.get(x, y));
    scanFinderLike(row);
  }
  for (let x = 0; x < n; x++) {
    const column: boolean[] = [];
    for (let y = 0; y < n; y++) column.push(symbol.get(x, y));
    scanFinderLike(column);
  }

  let dark = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (symbol.get(x, y)) dark++;
  const total = n * n;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(k, 0) * 10;

  return score;
}

/**
 * The finished symbol as rows of booleans, dark first. No quiet zone: the
 * renderer adds it, because how much white space to leave is a layout decision.
 */
export function qrMatrix(text: string, ecl: Ecl = "M"): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length, ecl);
  const symbol = new Symbol_(version);

  drawFunctionPatterns(symbol);
  drawCodewords(symbol, addEccAndInterleave(encodeData(bytes, version, ecl), version, ecl));

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(symbol, mask);
    drawFormatBits(symbol, ecl, mask);
    const score = penalty(symbol);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
    }
    applyMask(symbol, mask); // masking is its own inverse
  }
  applyMask(symbol, bestMask);
  drawFormatBits(symbol, ecl, bestMask);

  return symbol.modules;
}
