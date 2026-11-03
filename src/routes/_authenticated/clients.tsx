import { t } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { DirectoryPage } from "@/components/DirectoryPage";
import { hasAny, useMe } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: t("Клиенты — Ткани") }, { name: "description", content: t("Справочник клиентов") }, { property: "og:title", content: t("Клиенты — Ткани") }, { property: "og:description", content: t("Справочник клиентов") }] }),
  component: () => {
    const { data: me } = useMe();
    return (
      <DirectoryPage
        table="clients"
        title={t("Клиенты")}
        subtitle={t("Справочник организаций и частных клиентов")}
        canEdit={hasAny(me?.roles, ["sales_manager"])}
        fields={[
          { key: "name", label: t("Наименование"), required: true },
          { key: "inn", label: t("ИНН") },
          { key: "phone", label: t("Телефон") },
          { key: "email", label: "Email" },
          { key: "address", label: t("Адрес") },
        ]}
      />
    );
  },
});
