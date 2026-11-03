import { t } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/DirectoryPage";
import { hasAny, useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: t("Поставщики — Ткани") }, { name: "description", content: t("Справочник поставщиков тканей") }, { property: "og:title", content: t("Поставщики — Ткани") }, { property: "og:description", content: t("Справочник поставщиков тканей") }] }),
  component: () => {
    const { data: me } = useMe();
    return (
      <DirectoryPage
        table="suppliers"
        title={t("Поставщики")}
        subtitle={t("Фабрики и дистрибьюторы тканей")}
        canEdit={hasAny(me?.roles, ["sales_manager", "warehouse"])}
        fields={[
          { key: "name", label: t("Название"), required: true },
          { key: "contact_person", label: t("Контактное лицо") },
          { key: "phone", label: t("Телефон") },
          { key: "email", label: "Email" },
          { key: "country", label: t("Страна") },
        ]}
      />
    );
  },
});
