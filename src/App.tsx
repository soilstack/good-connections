import { type Card as SetCard, type Attr } from './game/cards'
import { Card } from './ui/Card'

/**
 * Slice-1 scaffold. For now this is a card gallery used to verify the <Card>
 * renderer against docs/reference-cards.png — every shape, fill, colour, and
 * count. The play UI replaces it next.
 */

const attrs: Attr[] = [0, 1, 2]
const SHAPE_NAMES = ['diamond', 'squiggle', 'oval']
const FILL_NAMES = ['solid', 'striped', 'open']

function c(count: Attr, colour: Attr, shape: Attr, fill: Attr): SetCard {
  return { count, colour, shape, fill }
}

export function App() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>Set</h1>
        <p className="muted">Card renderer preview — every shape × fill × colour, plus counts.</p>
      </header>

      {/* Counts 1–3 for one representative card */}
      <section>
        <h2>Counts</h2>
        <div className="grid grid-3">
          {attrs.map((count) => (
            <div className="cell" key={count}>
              <Card card={c(count, 2, 1, 1)} />
              <span className="cap">{count + 1}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Every shape × fill, shown per colour */}
      {attrs.map((colour) => (
        <section key={colour}>
          <h2 className="cap-title">{['red', 'green', 'purple'][colour]}</h2>
          <div className="grid grid-9">
            {attrs.map((shape) =>
              attrs.map((fill) => (
                <div className="cell" key={`${shape}-${fill}`}>
                  <Card card={c(1, colour, shape, fill)} />
                  <span className="cap">
                    {SHAPE_NAMES[shape]} · {FILL_NAMES[fill]}
                  </span>
                </div>
              )),
            )}
          </div>
        </section>
      ))}
    </main>
  )
}
