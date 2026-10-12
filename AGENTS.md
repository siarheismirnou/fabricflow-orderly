<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Data access goes through the browser Supabase client with RLS; role checks live in SQL helpers (`has_role`, `has_any_role`, `is_staff`) — UI role checks are cosmetic only.
- Stock is tracked per receipt lot (`stock_receipts.remaining_meters`), decremented by a DB trigger on `order_items` insert — keeps stock consistent without client logic.
- Order status history and notifications are written by a DB trigger on `orders` — so every status change notifies, regardless of caller.
- Report aggregation is pure functions in `src/lib/reports.ts` with tests — keeps business rules testable.
