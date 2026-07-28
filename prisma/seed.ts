import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const getPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not defined in .env file!');
  }
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

const prisma = getPrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('База данных уже содержит пользователей. Пропуск сидирования для защиты данных.');
    return;
  }

  console.log('Очистка старой базы данных...');
  await prisma.alert.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // ==========================================
  // 1. НАША БИБЛИОТЕКА СОТРУДНИКОВ
  // ==========================================
  const employeesLibrary = [
    { name: 'Быкаева Асия', phone: '+77774753253', role: 'ADMIN', title: 'Менеджер по маркетингу' },
    { name: 'Абиш Газиза', phone: '+77017705232', role: 'ENGINEER', title: 'Бухгалтер' },
    { name: 'Адилбек Медеу', phone: '+77752960641', role: 'ASSEMBLER', title: 'Слесарь КИПиА' },
    { name: 'Амирали Бакдаулет', phone: '+77073672899', role: 'ASSEMBLER', title: 'Слесарь КИПиА' },
    { name: 'Ан Александр', phone: '+77071089454', role: 'ENGINEER', title: 'Начальник участка 5 группы допуска' },
    { name: 'Аскарбекова Жанар', phone: '+77771354088', role: 'ENGINEER', title: 'Инженер сметчик' },
    { name: 'Аскаров Темирлан', phone: '+77473779749', role: 'ASSEMBLER', title: 'Слесарь КИПиА' },
    { name: 'Ахмеджанов Тимур', phone: '+77071511506', role: 'ASSEMBLER', title: 'Электромонтажник' },
    { name: 'Барлык Алибек', phone: '+77076632643', role: 'ASSEMBLER', title: 'Электромонтажник' },
    { name: 'Бахтыбаева Майгуль', phone: '+77751215294', role: 'ENGINEER', title: 'Главный-бухгалтер' },
    { name: 'Белоглазов Павел', phone: '+77052186407', role: 'ENGINEER', title: 'Инженер проектировщик' },
    { name: 'Беляев Богдан', phone: '+77474797904', role: 'ASSEMBLER', title: 'Слесарь КИПиА' },
    { name: 'Быкаев Жанат', phone: '87017658978', role: 'ENGINEER', title: 'Технический директор' },
    { name: 'Быкаев Канат', phone: '+77773701961', role: 'ENGINEER', title: 'Директор' },
    { name: 'Быкаев Рахим', phone: '+77715804918', role: 'ENGINEER', title: 'Проектировщик электронщик' },
    { name: 'Быкаев Шынгыс', phone: '+77078846914', role: 'ENGINEER', title: 'Специалист отдела программирования' },
    { name: 'Быкаева Айгуль', phone: '+77073215823', role: 'ENGINEER', title: 'Бухгалтер' },
    { name: 'Джумагалиев Адильжан', phone: '+77776244730', role: 'ASSEMBLER', title: 'Сварщик' },
    { name: 'Дуйсенов Болат', phone: '+77027812292', role: 'ENGINEER', title: 'Инженер по наладке и испытаниям' },
    { name: 'Еркинов Даурен', phone: '+77471849956', role: 'ENGINEER', title: 'Специалист отдела программирования' },
    { name: 'Жаккирей Куаныш', phone: '+77475756075', role: 'ENGINEER', title: 'Начальник отдела программирования' },
    { name: 'Жолымбетов Даниал', phone: '+77014552689', role: 'ENGINEER', title: 'Специалист отдела проектирования' },
    { name: 'Исаков Уткир', phone: '+77775472110', role: 'ASSEMBLER', title: 'Мастер' },
    { name: 'Кажаев Сергей', phone: '+77772488944', role: 'ENGINEER', title: 'Электромонтажник-наладчик КИПиА' },
    { name: 'Калбаев Асылбек', phone: '+77027264126', role: 'ASSEMBLER', title: 'Сварщик' },
    { name: 'Калиахметов Али', phone: '+77774141045', role: 'ASSEMBLER', title: 'Электромонтажник' },
    { name: 'Канабеков Ерлик', phone: '+77023300714', role: 'ENGINEER', title: 'Директор по производству' },
    { name: 'Карасай Жансерик', phone: '+77770306421', role: 'ENGINEER', title: 'Специалист отдела проектирования' },
    { name: 'Ксюсев Асаин', phone: '+77058093244', role: 'ENGINEER', title: 'Инженер слаботочных сетей' },
    { name: 'Куанхан Кузар', phone: '+77753072470', role: 'ASSEMBLER', title: 'Электромонтажник 3 разряда' },
    { name: 'Кубекенов Кенжебек', phone: '+77055655585', role: 'ASSEMBLER', title: 'Водитель-снабженец' },
    { name: 'Курбанбаев Бакытжан', phone: '+77073362050', role: 'ASSEMBLER', title: 'Электромонтажник 4 разряда' },
    { name: 'Курманбаев Тимурлан', phone: '+77079406742', role: 'ASSEMBLER', title: 'Охранник' },
    { name: 'Лаухин Илья', phone: '+77077451008', role: 'ENGINEER', title: 'Специалист отдела программирования' },
    { name: 'Локтева Татьяна', phone: '+77071775279', role: 'ASSEMBLER', title: 'Техничка' },
    { name: 'Лукьященко Александр', phone: '+77777056359', role: 'ENGINEER', title: 'Ведущий инженер КИПиА' },
    { name: 'Марал Данияр', phone: '+77077094227', role: 'ASSEMBLER', title: 'Электромонтажник' },
    { name: 'Матиенко Андрей', phone: '+77773994344', role: 'ASSEMBLER', title: 'Газо-электро сварщик 5 разряда' },
    { name: 'Момбаев Данияр', phone: '+77028381104', role: 'ASSEMBLER', title: 'Электромонтажник 4 разряда' },
    { name: 'Морожников Сергей', phone: '+77476050327', role: 'ASSEMBLER', title: 'Кладовщик' },
    { name: 'Мустафанов Санжар', phone: '+77719892789', role: 'ASSEMBLER', title: 'Слесарь КИПиА' },
    { name: 'Нурболды Даулеткелди', phone: '+77057724196', role: 'ASSEMBLER', title: 'Сварщик 6 разряда' },
    { name: 'Пусурманов Кайрат', phone: '+77772632326', role: 'ENGINEER', title: 'Инженер КИПиА' },
    { name: 'Ражапов Мырзабек', phone: '+77478066829', role: 'ENGINEER', title: 'Заместитель главного энергетика' },
    { name: 'Сейтбеков Елдос', phone: '+77073200675', role: 'ASSEMBLER', title: 'Электро монтажник' },
    { name: 'Телипайло Виталий', phone: '+77018877279', role: 'ASSEMBLER', title: 'Мастер' },
    { name: 'Толеубердин Ердаулет', phone: '+77781275524', role: 'ENGINEER', title: 'Специалист отдела проектирования' },
    { name: 'Фетисов Кирил', phone: '+77470568440', role: 'ASSEMBLER', title: 'Электромонтажник' },
    { name: 'Фурсов Вадим', phone: '+77074716802', role: 'ASSEMBLER', title: 'Слесарь КИПиА' },
    { name: 'Худайбердыев Роман', phone: '+77471679388', role: 'ASSEMBLER', title: 'Электромонтажник 4 разряда' },
    { name: 'Юн Геннадий', phone: '+77019500492', role: 'ENGINEER', title: 'Начальник производственного цеха' }
  ];

  for (const emp of employeesLibrary) {
    await prisma.user.create({ data: emp });
  }
  console.log('Пользователи успешно загружены...');

  // ==========================================
  // 2. ПРОЕКТЫ И ЗАДАЧИ С ЗАТРАТАМИ И БЮДЖЕТОМ
  // ==========================================

  // Проект 1
  const project1 = await prisma.project.create({
    data: {
      name: 'Модернизация АСУ ТП котельной Weishaupt',
      description: 'Проектирование, сборка шкафов и ПНР автоматики водогрейных котлов.',
      status: 'ASSEMBLY',
      budget: 8500000.00, // Бюджет проекта: 8.5 млн тенге
    },
  });

  await prisma.task.create({
    data: {
      projectId: project1.id,
      name: 'Разработка электрических схем шкафа котла',
      description: 'Разработать схемы Э3 в EPLAN, выгрузить спецификацию оборудования.',
      status: 'DONE',
      cost: 350000.00, // Затраты на проектирование
    }
  });

  await prisma.task.create({
    data: {
      projectId: project1.id,
      name: 'Закупка комплектующих Siemens и компонентов Onka',
      description: 'Заказать контроллер S7-1200, блоки питания, автоматические выключатели и оболочки (клеммы) Onka.',
      status: 'DONE',
      cost: 4200000.00, // Крупные расходы на закупку оборудования
    }
  });

  await prisma.task.create({
    data: {
      projectId: project1.id,
      name: 'Сборка и маркировка шкафа управления',
      description: 'Установить дин-рейки, кабельные каналы, произвести монтаж согласно схемам.',
      status: 'IN_PROGRESS',
      cost: 450000.00, // Затраты на сборку и расходные материалы
    }
  });


  // Проект 2
  const project2 = await prisma.project.create({
    data: {
      name: 'Внедрение ЧРП WEG на насосной станции',
      description: 'Разработка шкафа управления с частотными преобразователями WEG CFW500 для регулирования давления в сети.',
      status: 'DESIGN',
      budget: 5200000.00, // Бюджет проекта: 5.2 млн тенге
    },
  });

  await prisma.task.create({
    data: {
      projectId: project2.id,
      name: 'Разработка спецификации оборудования и схем',
      description: 'Подобрать ЧРП WEG под мощность насосов, начертить схемы автоматизации.',
      status: 'IN_PROGRESS',
      cost: 200000.00,
    }
  });

  await prisma.task.create({
    data: {
      projectId: project2.id,
      name: 'Заказ частотных преобразователей WEG',
      description: 'Оформить счет на оплату ЧРП у официального дистрибьютора.',
      status: 'PENDING',
      cost: 2900000.00, // Стоимость частотников WEG
    }
  });

  console.log('Проекты и задачи с финансовым учетом успешно созданы!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });