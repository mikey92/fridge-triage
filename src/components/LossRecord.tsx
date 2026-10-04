import { CHART_REVIEWED, CHART_URL } from "../chart";
import { formatHours, outageHours, verdict, type Item, type Outage } from "../rules";

const SNAP_DIRECTORY = "https://www.fns.usda.gov/snap/state-directory";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "not given";

/** A dated, printable list of what was thrown out, for SNAP replacement or an insurance claim: everything marked Toss,
 * and anything marked Check that the person ticked as thrown out. */
export function LossRecord({ items, outage, now }: { items: Item[]; outage: Outage; now: number }) {
  const tossed = items
    .map((item) => ({ item, verdict: verdict(item, outage, now) }))
    .filter(({ item, verdict }) => verdict.call === "toss" || (verdict.call === "check" && !verdict.pending && item.cleared));
  const hours = outageHours(outage, now);

  return (
    <article className="record">
      <h1 tabIndex={-1}>Food lost to a power outage</h1>
      <dl className="record-facts">
        <div><dt>Record made</dt><dd>{when(new Date(now).toISOString())}</dd></div>
        <div><dt>Power went out</dt><dd>{when(outage.start)}</dd></div>
        <div><dt>Power came back</dt><dd>{outage.end ? when(outage.end) : "still out when this was made"}</dd></div>
        <div><dt>Length</dt><dd>{hours === null ? "not given" : formatHours(hours)}</dd></div>
      </dl>

      {tossed.length ? (
        <table className="record-table">
          <caption>{tossed.length} item{tossed.length === 1 ? "" : "s"} thrown out</caption>
          <thead>
            <tr><th scope="col">Item</th><th scope="col">Where</th><th scope="col">FoodSafety.gov chart row</th><th scope="col">Value ($)</th></tr>
          </thead>
          <tbody>
            {tossed.map(({ item, verdict }) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.place}</td>
                <td>{verdict.row?.label ?? "Not on the chart"}{verdict.call === "check" ? " (checked, thrown out)" : ""}</td>
                <td className="blank" aria-label="fill in by hand" />
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Nothing on the list is marked Toss, or ticked as thrown out under Check, yet.</p>
      )}

      <section className="record-notes">
        <h2>Using this record</h2>
        <p>
          <strong>SNAP:</strong> households on SNAP can ask their state SNAP office to replace food lost in a power outage.
          Report the loss within 10 days; your state may have other conditions. Find your office at{" "}
          <a href={SNAP_DIRECTORY}>{SNAP_DIRECTORY.replace("https://", "")}</a>.
        </p>
        <p><strong>Insurance:</strong> some homeowner's and renter's policies cover food that spoils in an outage. Check your policy.</p>
        <p className="source">
          Decisions follow the FoodSafety.gov power-outage charts (reviewed {CHART_REVIEWED}): {CHART_URL}. Made with Fridge Triage.
        </p>
      </section>
    </article>
  );
}
