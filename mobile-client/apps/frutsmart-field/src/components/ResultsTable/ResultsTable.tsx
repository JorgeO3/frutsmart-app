import React from "react";

import type { ResultsTableProps } from "./types";

import TableRow from "./TableRow";
import TableHeader from "./TableHeader";
import TableFooter from "./TableFooter";
import TableContainer from "./TableContainer";

const ResultsTable = (props: ResultsTableProps) => {
  const { title, columns, data, totalKey, colors, IconPlaceholder } = props;
  return (
    <TableContainer colors={colors}>
      <TableHeader title={title} IconPlaceholder={IconPlaceholder} />
      {data.map((row, idx) => (
        <TableRow
          key={`${row[columns[0].key]}-${idx}`}
          row={row}
          columns={columns}
          totalKey={totalKey}
        />
      ))}
      <TableFooter data={data} totalKey={totalKey} />
    </TableContainer>
  );
};

export default React.memo(ResultsTable);
