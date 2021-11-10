import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import * as rawgraphsCore from '@rawgraphs/rawgraphs-core'
import charts from '../charts'

// Init inject hook
window.RAWGRAPH_APP_INJECT_HOOK = []

// Expose vendor
window.rawgraphsCore = rawgraphsCore
window.d3 = d3

function makeSetNewChartsUniqueFn(newChartsToInject) {
  return (prevCharts) => {
    const newIds = newChartsToInject.map((c) => c.metadata.id)
    return prevCharts
      .filter((c) => !newIds.includes(c.metadata.id))
      .concat(newChartsToInject)
  }
}

function popAllCustomChartsStack() {
  const newChartsToInject = []
  // Read the populated stack
  while (window.RAWGRAPH_APP_INJECT_HOOK.length > 0) {
    newChartsToInject.push(window.RAWGRAPH_APP_INJECT_HOOK.pop())
  }
  return newChartsToInject
}

export default function useCharts() {
  const [customCharts, setCustomCharts] = useState([])

  useEffect(() => {
    // Grab all scripts in cache
    window.caches.open('customCharts').then((cache) => {
      cache
        .matchAll()
        // Get all blobs
        .then((m) => {
          return Promise.all(m.map((r) => r.blob()))
        })
        // Generate urls for blobs and wait all scripts to load
        .then((blobs) => {
          return Promise.all(
            blobs.map((blob) => {
              return new Promise((resolve) => {
                const url = URL.createObjectURL(blob)
                const scriptTag = document.createElement('script')
                scriptTag.src = url
                scriptTag.addEventListener('load', resolve, {
                  once: true,
                })
                document.head.append(scriptTag)
              })
            })
          )
        })
        // Finally read the stack and add charts in cache to current state
        .then(() => {
          const newChartsToInject = popAllCustomChartsStack()
          setCustomCharts(makeSetNewChartsUniqueFn(newChartsToInject))
        })
    })
  }, [])

  function uploadCustomChart(file) {
    if (!file) {
      return
    }
    const url = URL.createObjectURL(file)
    const scriptTag = document.createElement('script')
    scriptTag.src = url
    scriptTag.addEventListener(
      'load',
      () => {
        const newChartsToInject = popAllCustomChartsStack()
        setCustomCharts(makeSetNewChartsUniqueFn(newChartsToInject))

        // TODO: Find a better approach
        const rawPkg = newChartsToInject
          .map((r) => r.metadata.id)[0]
          ?.split('.')?.[0]

        if (rawPkg) {
          window.caches.open('customCharts').then((cache) => {
            cache.put(rawPkg, new Response(file))
          })
        }
      },
      {
        once: true,
      }
    )
    document.head.append(scriptTag)
  }

  const allCharts = useMemo(() => charts.concat(customCharts), [customCharts])
  return [allCharts, { uploadCustomChart }]
}