# Fabricflow Orderly

Нужно создать внутреннюю систему для компании занимающейся продажей тканей. Предусмотреть функционал создания заказа от клиента (выбор клиента из справочника), выбор товара (со склада (функционал поиска по складским позициям по справочнику) или под заказ (выбор поставщика товара из справочника)). Переход заказа по статусам (новый, в работе, ожидает оплаты, оплачен, в пути, на складе, завершён). Система должна предусматривать разграничение по ролям: Супер-админ, бухгалтер., менеджер по продажам, специалист по кадрам, складской специалист. Система должна иметь возможность вносить товар на склад который пришёл, отображать остатки, цену прихода, сколько осталось (метры). Предусмотреть систему уведомлений соответствующих пользователей при переходе заявки из статуса. Реализовать формирование графиков и таблиц по остаткам, по проданным товарам за неделю, месяц, год, по конкретному специалисту и по организации в целом.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fabricflow-orderly.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1028316b-9bc3-4966-9e73-88ae87aeee60).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
