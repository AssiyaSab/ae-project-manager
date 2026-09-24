import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const csvData = `1;Абиш Газиза;Инженер;Активен;g.abish;Star204!
2;Адилбек Медеу;Сборщик;В архиве;m.adilbek;Fort731#
3;Амирали Бакдаулет;Сборщик;Активен;b.amirali;Nord915@
4;Ан Александр;Инженер;Активен;a.an;Fast382*
5;Аскарбекова Жанар;Инженер;Активен;zh.askarbekova;Work647!
6;Аскаров Темирлан;Сборщик;Активен;t.askarov;Blue159#
7;Ахмеджанов Тимур;Сборщик;В архиве;t.akhmedzhanov;Port826@
8;Барлык Алибек;Сборщик;В архиве;a.barlyk;Base473*
9;Бахтыбаева Майгуль;Инженер;Активен;m.bakhtybaeva;Gold591!
10;Белоглазов Павел;Инженер;Активен;p.beloglazov;Wind318#
11;Беляев Богдан;Сборщик;В архиве;b.belyaev;Line742@
12;Быкаев Жанат;ГИП;Активен;zh.bykaev;Peak963*
13;Быкаев Канат;ГИП;Активен;k.bykaev;Code285!
14;Быкаев Рахим;Инженер;Активен;r.bykaev;Team537#
15;Быкаев Шынгыс;Инженер;Активен;sh.bykaev;Task814@
16;Быкаева Айгуль;Инженер;Активен;ai.bykaeva;Safe629*
17;Быкаева Асия;ГИП;Активен;as.bykaeva;City371!
18;Джумагалиев Адильхан;Сборщик;В архиве;a.dzhumagaliev;Next495#
19;Дуйсенов Болат;Инженер;Активен;b.duisenov;Real832@
20;Еркинов Даурен;Инженер;Активен;d.erkinov;Best164*
21;Жаккирей Куаныш;Инженер;Активен;k.zhakkirei;Path758!
22;Жолымбетов Данияр;Инженер;Активен;d.zholymbetov;Echo923#
23;Исаков Уткир;Сборщик;Активен;u.isakov;Rock346@
24;Кажаев Сергей;Инженер;Активен;s.kazhaev;Core681*
25;Калбаев Асылбек;Сборщик;В архиве;a.kalbaev;Unit219!
26;Калиахметов Али;Сборщик;Активен;a.kaliakhmetov;Nova574#
27;Канабеков Ерлик;Инженер;Активен;e.kanabekov;Iron842@
28;Карасай Жансерик;Инженер;Активен;zh.karasai;View367*
29;Ксюсев Асаин;Инженер;Активен;a.ksyusev;Apex791!
30;Куанхан Кузар;Сборщик;Активен;k.kuankhan;Zone428#
31;Кубекенов Кенжебек;Сборщик;Активен;k.kubekenov;Byte953@
32;Кулешов Юрий;Инженер;Активен;y.kuleshov;Flow186*
33;Курбанбаев Бакытжан;Сборщик;Активен;b.kurbanbaev;Gate632!
34;Курманбаев Тимурлан;Сборщик;Активен;t.kurmanbaev;Ship275#
35;Лаухин Илья;Инженер;Активен;i.laukhin;Link849@
36;Локтева Татьяна;Сборщик;Активен;t.lokteva;Meta513*
37;Лукьященко Александр;Инженер;Активен;a.lukyashchenko;Camp764!
38;Марал Данияр;Сборщик;Активен;d.maral;Desk329#
39;Матиенко Андрей;Сборщик;В архиве;a.matienko;Time892@
40;Момбаев Данияр;Сборщик;Активен;d.mombaev;Bold417*
41;Морожников Сергей;Сборщик;Активен;s.morozhnikov;Host653!
42;Мустафанов Санжар;Сборщик;Активен;s.mustafanov;Free281#
43;Нурболды Даулеткелди;Сборщик;Активен;d.nurboldy;Cool937@
44;Пусурманов Кайрат;Инженер;Активен;k.pusurmanov;Mark574*
45;Ражапов Мырзабек;Инженер;Активен;m.razhapov;Root148!
46;Сейтбеков Елдос;Сборщик;Активен;e.seitbekov;Dark826#
47;Телипайло Виталий;Сборщик;Активен;v.telipailo;Jump391@
48;Толеубердин Ердаулет;Инженер;Активен;e.toleuberdin;West765*
49;Фетисов Кирилл;Сборщик;Активен;k.fetisov;True419!
50;Фурсов Вадим;Сборщик;Активен;v.fursov;Plan852#
51;Худайбердыев Роман;Сборщик;Активен;r.khudaiberdyev;Zero237@
52;Юн Геннадий;Инженер;Активен;g.yun;Safe694*`;

async function main() {
  const lines = csvData.trim().split('\n');
  let updatedCount = 0;
  let notFound = [];

  for (const line of lines) {
    if (!line.trim() || line.startsWith('№')) continue;
    
    const parts = line.split(';');
    if (parts.length >= 6) {
      const name = parts[1].trim();
      const login = parts[4].trim();
      const password = parts[5].trim();
      
      const roleRaw = parts[2].trim().toUpperCase();
      let role = 'ENGINEER';
      if (roleRaw.includes('ГИП') || roleRaw.includes('РУКОВОД') || roleRaw.includes('АДМИН')) role = 'ADMIN';
      else if (roleRaw.includes('БУХ')) role = 'ACCOUNTANT';
      else if (roleRaw.includes('СБОР')) role = 'ASSEMBLER';
      else if (roleRaw.includes('МЕНЕДЖЕР')) role = 'MANAGER';

      const isActive = parts[3].trim().toLowerCase() === 'активен';

      // Use a more relaxed search just in case there's a space mismatch
      const users = await prisma.user.findMany();
      const user = users.find(u => u.name.trim().toLowerCase() === name.toLowerCase());

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            login, 
            password,
            role,
            isActive
          }
        });
        updatedCount++;
        console.log(`✅ Updated: ${name} (login: ${login})`);
      } else {
        // If not found, let's create them so the database is fully up to date!
        const newUser = await prisma.user.create({
            data: {
                name,
                role,
                isActive,
                login,
                password,
                phone: null,
                title: parts[2].trim()
            }
        });
        updatedCount++;
        console.log(`➕ Created: ${name} (login: ${login})`);
      }
    }
  }

  console.log(`\n🎉 Processed ${updatedCount} users successfully!`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
