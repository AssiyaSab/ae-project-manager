/**
 * Преобразование числа в сумму прописью (тенге)
 */
export function numberToWordsKzt(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Ноль тенге 00 тиын';

  const units = [
    ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
    ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
  ];

  const teens = [
    'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
    'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
  ];

  const tens = [
    '', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят',
    'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто',
  ];

  const hundreds = [
    '', 'сто', 'двести', 'триста', 'четыреста',
    'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот',
  ];

  const thousandsForms = ['тысяча', 'тысячи', 'тысяч'];
  const millionsForms = ['миллион', 'миллиона', 'миллионов'];
  const billionsForms = ['миллиард', 'миллиарда', 'миллиардов'];

  function pluralForm(n: number, forms: string[]): string {
    const rem100 = n % 100;
    const rem10 = n % 10;
    if (rem100 >= 11 && rem100 <= 19) return forms[2];
    if (rem10 === 1) return forms[0];
    if (rem10 >= 2 && rem10 <= 4) return forms[1];
    return forms[2];
  }

  function triadToWords(num: number, gender: number): string {
    const h = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;

    const parts: string[] = [];

    if (h > 0) parts.push(hundreds[h]);

    if (d === 1) {
      parts.push(teens[u]);
    } else {
      if (d > 1) parts.push(tens[d]);
      if (u > 0) parts.push(units[gender][u]);
    }

    return parts.join(' ');
  }

  const intPart = Math.floor(amount);
  const tiynPart = Math.round((amount - intPart) * 100);

  const billions = Math.floor(intPart / 1000000000);
  const millions = Math.floor((intPart % 1000000000) / 1000000);
  const thousands = Math.floor((intPart % 1000000) / 1000);
  const rest = intPart % 1000;

  const words: string[] = [];

  if (billions > 0) {
    words.push(triadToWords(billions, 0));
    words.push(pluralForm(billions, billionsForms));
  }

  if (millions > 0) {
    words.push(triadToWords(millions, 0));
    words.push(pluralForm(millions, millionsForms));
  }

  if (thousands > 0) {
    words.push(triadToWords(thousands, 1));
    words.push(pluralForm(thousands, thousandsForms));
  }

  if (rest > 0 || words.length === 0) {
    words.push(triadToWords(rest, 0));
  }

  const resultWords = words.filter(Boolean).join(' ').trim();
  const capitalized = resultWords.charAt(0).toUpperCase() + resultWords.slice(1);
  const tiynStr = String(tiynPart).padStart(2, '0');

  return `${capitalized} тенге ${tiynStr} тиын`;
}
