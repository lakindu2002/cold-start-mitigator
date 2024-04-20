import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
  Box,
  Table,
  Container,
  TableBody,
  Typography,
  TableContainer,
  TablePagination,
  CircularProgress,
} from '@mui/material';

import { getFunctionsInProject } from 'src/redux/slices/projects';

import Scrollbar from 'src/components/scrollbar';

import TableNoData from '../table-no-data';
import TableEmptyRows from '../table-empty-rows';
import FunctionTableRow from '../function-table-row';
import FunctionTableHead from '../function-table-head';
import FunctionTableToolbar from '../function-table-toolbar';
import { emptyRows, applyFilter, getComparator } from '../utils';

const FunctionsView = () => {
  const dispatch = useDispatch();
  const { functions = [], project, functionsLoading } = useSelector((state) => state.projects);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState('asc');
  const [selected, setSelected] = useState([]);
  const [orderBy, setOrderBy] = useState('name');
  const [filterName, setFilterName] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    dispatch(getFunctionsInProject());
  }, [dispatch]);

  const handleSort = (event, id) => {
    const isAsc = orderBy === id && order === 'asc';
    if (id !== '') {
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(id);
    }
  };

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelecteds = functions.map((n) => n.name);
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  };

  const handleClick = (_event, name) => {
    const selectedIndex = selected.indexOf(name);
    let newSelected = [];
    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, name);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }
    setSelected(newSelected);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  const handleFilterByName = (event) => {
    setPage(0);
    setFilterName(event.target.value);
  };

  const dataFiltered = applyFilter({
    inputData: functions,
    comparator: getComparator(order, orderBy),
    filterName,
  });

  const notFound = !dataFiltered.length && !!filterName;

  return (
    <Container>
      <Typography variant="h4">Lambda Functions</Typography>
      <Typography variant="caption">
        Here&apos;s Lambda functions that match your prefix: {project.patterns.join(', ')} in
        region: {project.region}
      </Typography>

      {functionsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', my: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          <FunctionTableToolbar
            numSelected={selected.length}
            filterName={filterName}
            onFilterName={handleFilterByName}
          />
          <Scrollbar>
            <TableContainer sx={{ overflow: 'unset' }}>
              <Table sx={{ minWidth: 800 }}>
                <FunctionTableHead
                  order={order}
                  orderBy={orderBy}
                  rowCount={functions.length}
                  numSelected={selected.length}
                  onRequestSort={handleSort}
                  onSelectAllClick={handleSelectAllClick}
                  headLabel={[
                    { id: 'name', label: 'Name' },
                    { id: 'arn', label: 'ARN' },
                    { id: 'lastInvokedAt', label: 'Last Invoked At' },
                    { id: 'ephemeralStorageSize', label: 'Ephemeral Storage' },
                    { id: 'functionUpdatedAt', label: 'Updated At' },
                    { id: 'memorySize', label: 'Memory Size' },
                    { id: 'runtime', label: 'Runtime' },
                    { id: 'timeout', label: 'Timeout' },
                    { id: '', label: '' },
                  ]}
                />
                <TableBody>
                  {dataFiltered
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((row) => (
                      <FunctionTableRow
                        key={row.id}
                        name={row.name}
                        arn={row.arn}
                        ephemeralStorageSize={row.ephemeralStorageSize}
                        functionUpdatedAt={row.functionUpdatedAt}
                        memorySize={row.memorySize}
                        runtime={row.runtime}
                        timeout={row.timeout}
                        lastInvokedAt={row.lastInvokedAt}
                        cold={row.wasCold}
                        selected={selected.indexOf(row.name) !== -1}
                        handleClick={(event) => handleClick(event, row.name)}
                      />
                    ))}

                  <TableEmptyRows
                    height={77}
                    emptyRows={emptyRows(page, rowsPerPage, functions.length)}
                  />

                  {notFound && <TableNoData query={filterName} />}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>

          <TablePagination
            page={page}
            component="div"
            count={functions.length}
            rowsPerPage={rowsPerPage}
            onPageChange={handleChangePage}
            rowsPerPageOptions={[5, 10, 25]}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Box>
      )}
    </Container>
  );
};

export default FunctionsView;
