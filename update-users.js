"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
var csvData = "1;\u0410\u0431\u0438\u0448 \u0413\u0430\u0437\u0438\u0437\u0430;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;g.abish;Star204!\n2;\u0410\u0434\u0438\u043B\u0431\u0435\u043A \u041C\u0435\u0434\u0435\u0443;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0412 \u0430\u0440\u0445\u0438\u0432\u0435;m.adilbek;Fort731#\n3;\u0410\u043C\u0438\u0440\u0430\u043B\u0438 \u0411\u0430\u043A\u0434\u0430\u0443\u043B\u0435\u0442;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;b.amirali;Nord915@\n4;\u0410\u043D \u0410\u043B\u0435\u043A\u0441\u0430\u043D\u0434\u0440;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;a.an;Fast382*\n5;\u0410\u0441\u043A\u0430\u0440\u0431\u0435\u043A\u043E\u0432\u0430 \u0416\u0430\u043D\u0430\u0440;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;zh.askarbekova;Work647!\n6;\u0410\u0441\u043A\u0430\u0440\u043E\u0432 \u0422\u0435\u043C\u0438\u0440\u043B\u0430\u043D;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;t.askarov;Blue159#\n7;\u0410\u0445\u043C\u0435\u0434\u0436\u0430\u043D\u043E\u0432 \u0422\u0438\u043C\u0443\u0440;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0412 \u0430\u0440\u0445\u0438\u0432\u0435;t.akhmedzhanov;Port826@\n8;\u0411\u0430\u0440\u043B\u044B\u043A \u0410\u043B\u0438\u0431\u0435\u043A;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0412 \u0430\u0440\u0445\u0438\u0432\u0435;a.barlyk;Base473*\n9;\u0411\u0430\u0445\u0442\u044B\u0431\u0430\u0435\u0432\u0430 \u041C\u0430\u0439\u0433\u0443\u043B\u044C;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;m.bakhtybaeva;Gold591!\n10;\u0411\u0435\u043B\u043E\u0433\u043B\u0430\u0437\u043E\u0432 \u041F\u0430\u0432\u0435\u043B;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;p.beloglazov;Wind318#\n11;\u0411\u0435\u043B\u044F\u0435\u0432 \u0411\u043E\u0433\u0434\u0430\u043D;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0412 \u0430\u0440\u0445\u0438\u0432\u0435;b.belyaev;Line742@\n12;\u0411\u044B\u043A\u0430\u0435\u0432 \u0416\u0430\u043D\u0430\u0442;\u0413\u0418\u041F;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;zh.bykaev;Peak963*\n13;\u0411\u044B\u043A\u0430\u0435\u0432 \u041A\u0430\u043D\u0430\u0442;\u0413\u0418\u041F;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;k.bykaev;Code285!\n14;\u0411\u044B\u043A\u0430\u0435\u0432 \u0420\u0430\u0445\u0438\u043C;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;r.bykaev;Team537#\n15;\u0411\u044B\u043A\u0430\u0435\u0432 \u0428\u044B\u043D\u0433\u044B\u0441;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;sh.bykaev;Task814@\n16;\u0411\u044B\u043A\u0430\u0435\u0432\u0430 \u0410\u0439\u0433\u0443\u043B\u044C;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;ai.bykaeva;Safe629*\n17;\u0411\u044B\u043A\u0430\u0435\u0432\u0430 \u0410\u0441\u0438\u044F;\u0413\u0418\u041F;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;as.bykaeva;City371!\n18;\u0414\u0436\u0443\u043C\u0430\u0433\u0430\u043B\u0438\u0435\u0432 \u0410\u0434\u0438\u043B\u044C\u0445\u0430\u043D;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0412 \u0430\u0440\u0445\u0438\u0432\u0435;a.dzhumagaliev;Next495#\n19;\u0414\u0443\u0439\u0441\u0435\u043D\u043E\u0432 \u0411\u043E\u043B\u0430\u0442;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;b.duisenov;Real832@\n20;\u0415\u0440\u043A\u0438\u043D\u043E\u0432 \u0414\u0430\u0443\u0440\u0435\u043D;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;d.erkinov;Best164*\n21;\u0416\u0430\u043A\u043A\u0438\u0440\u0435\u0439 \u041A\u0443\u0430\u043D\u044B\u0448;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;k.zhakkirei;Path758!\n22;\u0416\u043E\u043B\u044B\u043C\u0431\u0435\u0442\u043E\u0432 \u0414\u0430\u043D\u0438\u044F\u0440;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;d.zholymbetov;Echo923#\n23;\u0418\u0441\u0430\u043A\u043E\u0432 \u0423\u0442\u043A\u0438\u0440;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;u.isakov;Rock346@\n24;\u041A\u0430\u0436\u0430\u0435\u0432 \u0421\u0435\u0440\u0433\u0435\u0439;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;s.kazhaev;Core681*\n25;\u041A\u0430\u043B\u0431\u0430\u0435\u0432 \u0410\u0441\u044B\u043B\u0431\u0435\u043A;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0412 \u0430\u0440\u0445\u0438\u0432\u0435;a.kalbaev;Unit219!\n26;\u041A\u0430\u043B\u0438\u0430\u0445\u043C\u0435\u0442\u043E\u0432 \u0410\u043B\u0438;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;a.kaliakhmetov;Nova574#\n27;\u041A\u0430\u043D\u0430\u0431\u0435\u043A\u043E\u0432 \u0415\u0440\u043B\u0438\u043A;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;e.kanabekov;Iron842@\n28;\u041A\u0430\u0440\u0430\u0441\u0430\u0439 \u0416\u0430\u043D\u0441\u0435\u0440\u0438\u043A;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;zh.karasai;View367*\n29;\u041A\u0441\u044E\u0441\u0435\u0432 \u0410\u0441\u0430\u0438\u043D;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;a.ksyusev;Apex791!\n30;\u041A\u0443\u0430\u043D\u0445\u0430\u043D \u041A\u0443\u0437\u0430\u0440;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;k.kuankhan;Zone428#\n31;\u041A\u0443\u0431\u0435\u043A\u0435\u043D\u043E\u0432 \u041A\u0435\u043D\u0436\u0435\u0431\u0435\u043A;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;k.kubekenov;Byte953@\n32;\u041A\u0443\u043B\u0435\u0448\u043E\u0432 \u042E\u0440\u0438\u0439;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;y.kuleshov;Flow186*\n33;\u041A\u0443\u0440\u0431\u0430\u043D\u0431\u0430\u0435\u0432 \u0411\u0430\u043A\u044B\u0442\u0436\u0430\u043D;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;b.kurbanbaev;Gate632!\n34;\u041A\u0443\u0440\u043C\u0430\u043D\u0431\u0430\u0435\u0432 \u0422\u0438\u043C\u0443\u0440\u043B\u0430\u043D;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;t.kurmanbaev;Ship275#\n35;\u041B\u0430\u0443\u0445\u0438\u043D \u0418\u043B\u044C\u044F;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;i.laukhin;Link849@\n36;\u041B\u043E\u043A\u0442\u0435\u0432\u0430 \u0422\u0430\u0442\u044C\u044F\u043D\u0430;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;t.lokteva;Meta513*\n37;\u041B\u0443\u043A\u044C\u044F\u0449\u0435\u043D\u043A\u043E \u0410\u043B\u0435\u043A\u0441\u0430\u043D\u0434\u0440;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;a.lukyashchenko;Camp764!\n38;\u041C\u0430\u0440\u0430\u043B \u0414\u0430\u043D\u0438\u044F\u0440;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;d.maral;Desk329#\n39;\u041C\u0430\u0442\u0438\u0435\u043D\u043A\u043E \u0410\u043D\u0434\u0440\u0435\u0439;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0412 \u0430\u0440\u0445\u0438\u0432\u0435;a.matienko;Time892@\n40;\u041C\u043E\u043C\u0431\u0430\u0435\u0432 \u0414\u0430\u043D\u0438\u044F\u0440;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;d.mombaev;Bold417*\n41;\u041C\u043E\u0440\u043E\u0436\u043D\u0438\u043A\u043E\u0432 \u0421\u0435\u0440\u0433\u0435\u0439;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;s.morozhnikov;Host653!\n42;\u041C\u0443\u0441\u0442\u0430\u0444\u0430\u043D\u043E\u0432 \u0421\u0430\u043D\u0436\u0430\u0440;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;s.mustafanov;Free281#\n43;\u041D\u0443\u0440\u0431\u043E\u043B\u0434\u044B \u0414\u0430\u0443\u043B\u0435\u0442\u043A\u0435\u043B\u0434\u0438;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;d.nurboldy;Cool937@\n44;\u041F\u0443\u0441\u0443\u0440\u043C\u0430\u043D\u043E\u0432 \u041A\u0430\u0439\u0440\u0430\u0442;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;k.pusurmanov;Mark574*\n45;\u0420\u0430\u0436\u0430\u043F\u043E\u0432 \u041C\u044B\u0440\u0437\u0430\u0431\u0435\u043A;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;m.razhapov;Root148!\n46;\u0421\u0435\u0439\u0442\u0431\u0435\u043A\u043E\u0432 \u0415\u043B\u0434\u043E\u0441;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;e.seitbekov;Dark826#\n47;\u0422\u0435\u043B\u0438\u043F\u0430\u0439\u043B\u043E \u0412\u0438\u0442\u0430\u043B\u0438\u0439;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;v.telipailo;Jump391@\n48;\u0422\u043E\u043B\u0435\u0443\u0431\u0435\u0440\u0434\u0438\u043D \u0415\u0440\u0434\u0430\u0443\u043B\u0435\u0442;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;e.toleuberdin;West765*\n49;\u0424\u0435\u0442\u0438\u0441\u043E\u0432 \u041A\u0438\u0440\u0438\u043B\u043B;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;k.fetisov;True419!\n50;\u0424\u0443\u0440\u0441\u043E\u0432 \u0412\u0430\u0434\u0438\u043C;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;v.fursov;Plan852#\n51;\u0425\u0443\u0434\u0430\u0439\u0431\u0435\u0440\u0434\u044B\u0435\u0432 \u0420\u043E\u043C\u0430\u043D;\u0421\u0431\u043E\u0440\u0449\u0438\u043A;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;r.khudaiberdyev;Zero237@\n52;\u042E\u043D \u0413\u0435\u043D\u043D\u0430\u0434\u0438\u0439;\u0418\u043D\u0436\u0435\u043D\u0435\u0440;\u0410\u043A\u0442\u0438\u0432\u0435\u043D;g.yun;Safe694*";
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var lines, updatedCount, notFound, _loop_1, _i, lines_1, line;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    lines = csvData.trim().split('\n');
                    updatedCount = 0;
                    notFound = [];
                    _loop_1 = function (line) {
                        var parts, name_1, login, password, roleRaw, role, isActive, users, user, newUser;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!line.trim() || line.startsWith('№'))
                                        return [2 /*return*/, "continue"];
                                    parts = line.split(';');
                                    if (!(parts.length >= 6)) return [3 /*break*/, 5];
                                    name_1 = parts[1].trim();
                                    login = parts[4].trim();
                                    password = parts[5].trim();
                                    roleRaw = parts[2].trim().toUpperCase();
                                    role = 'ENGINEER';
                                    if (roleRaw.includes('ГИП') || roleRaw.includes('РУКОВОД') || roleRaw.includes('АДМИН'))
                                        role = 'ADMIN';
                                    else if (roleRaw.includes('БУХ'))
                                        role = 'ACCOUNTANT';
                                    else if (roleRaw.includes('СБОР'))
                                        role = 'ASSEMBLER';
                                    else if (roleRaw.includes('МЕНЕДЖЕР'))
                                        role = 'MANAGER';
                                    isActive = parts[3].trim().toLowerCase() === 'активен';
                                    return [4 /*yield*/, prisma.user.findMany()];
                                case 1:
                                    users = _b.sent();
                                    user = users.find(function (u) { return u.name.trim().toLowerCase() === name_1.toLowerCase(); });
                                    if (!user) return [3 /*break*/, 3];
                                    return [4 /*yield*/, prisma.user.update({
                                            where: { id: user.id },
                                            data: {
                                                login: login,
                                                password: password,
                                                role: role,
                                                isActive: isActive
                                            }
                                        })];
                                case 2:
                                    _b.sent();
                                    updatedCount++;
                                    console.log("\u2705 Updated: ".concat(name_1, " (login: ").concat(login, ")"));
                                    return [3 /*break*/, 5];
                                case 3: return [4 /*yield*/, prisma.user.create({
                                        data: {
                                            name: name_1,
                                            role: role,
                                            isActive: isActive,
                                            login: login,
                                            password: password,
                                            phone: null,
                                            title: parts[2].trim()
                                        }
                                    })];
                                case 4:
                                    newUser = _b.sent();
                                    updatedCount++;
                                    console.log("\u2795 Created: ".concat(name_1, " (login: ").concat(login, ")"));
                                    _b.label = 5;
                                case 5: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, lines_1 = lines;
                    _a.label = 1;
                case 1:
                    if (!(_i < lines_1.length)) return [3 /*break*/, 4];
                    line = lines_1[_i];
                    return [5 /*yield**/, _loop_1(line)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\n\uD83C\uDF89 Processed ".concat(updatedCount, " users successfully!"));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) { return console.error(e); })
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
