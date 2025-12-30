"use client";

import { useCallback } from "react";

import { NonogramGridCell } from "./nonogram-grid-cell";
import { useNonogramStore } from "./store";

type Props = {
  onDragMove: (event: React.MouseEvent) => void;
  shouldHighlightMistakes?: boolean;
};

export function NonogramsGrid({ onDragMove, shouldHighlightMistakes }: Props) {
  const dragStartCellId = useNonogramStore((state) => state.dragStartCellId);
  const grid = useNonogramStore((state) => state.grid);

  const setHighlightedColumn = useNonogramStore(
    (state) => state.setHighlightedColumn
  );
  const setHighlightedRow = useNonogramStore(
    (state) => state.setHighlightedRow
  );
  const stopDragging = useNonogramStore((state) => state.stopDragging);

  const handleMouseLeave = useCallback(() => {
    stopDragging();

    setHighlightedColumn(undefined);
    setHighlightedRow(undefined);
  }, [setHighlightedColumn, setHighlightedRow, stopDragging]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (dragStartCellId) {
        onDragMove(event);
      }
    },
    [dragStartCellId, onDragMove]
  );

  return (
    <div
      className="overflow-hidden rounded-br border-2 border-foreground"
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {grid.map((row, index) => (
        <div
          className="grid grid-flow-col border-foreground not-last:border-b not-last:nth-[5n]:border-b-2"
          key={`row-${index}`}
        >
          {row.map((id) => (
            <NonogramGridCell
              id={id}
              key={id}
              shouldHighlightMistakes={shouldHighlightMistakes}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
