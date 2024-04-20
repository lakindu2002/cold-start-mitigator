import { useState } from 'react';
import { format } from 'date-fns';
import PropTypes from 'prop-types';

import Popover from '@mui/material/Popover';
import { Box, Tooltip } from '@mui/material';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

export default function FunctionTableRow({
  selected,
  name,
  arn,
  ephemeralStorageSize,
  functionUpdatedAt,
  memorySize,
  runtime,
  timeout,
  lastInvokedAt,
  cold,
  handleClick,
  handleViewLogs,
  warmerArn,
  warmerTime,
  warmedAt,
}) {
  const [open, setOpen] = useState(null);

  const handleOpenMenu = (event) => {
    setOpen(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setOpen(null);
  };

  return (
    <>
      <TableRow
        hover
        tabIndex={-1}
        role="checkbox"
        selected={selected}
        sx={{
          ...(warmerArn && {
            background: (theme) => theme.palette.warning.light,
          }),
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox disableRipple checked={selected} onChange={handleClick} />
        </TableCell>

        <TableCell component="th" scope="row" padding="none">
          {name}
          {(warmerTime || warmedAt) && (
            <Tooltip
              title={
                warmedAt && !warmerTime
                  ? `Function was warmed at ${format(warmedAt, 'dd MMMM yyyy hh:mm:ss a')}`
                  : `Function set to be invoked at ${format(
                      new Date(warmerTime),
                      'dd MMMM yyyy hh:mm:ss a'
                    )}`
              }
            >
              <Box>
                <Iconify icon="eva:question-mark-fill" />
              </Box>
            </Tooltip>
          )}
        </TableCell>

        <TableCell>{arn}</TableCell>

        <TableCell>
          {lastInvokedAt ? (
            <>
              {format(lastInvokedAt, 'dd MMMM yyyy hh:mm:ss a')} |{' '}
              {cold ? 'Cold Start' : 'Warm Instance'}
            </>
          ) : (
            <>Not Invoked Yet</>
          )}
        </TableCell>

        <TableCell>{ephemeralStorageSize} MB</TableCell>

        <TableCell>{format(new Date(functionUpdatedAt), 'dd MMMM yyyy hh:mm:ss a')}</TableCell>

        <TableCell>{memorySize} MB</TableCell>

        <TableCell>{runtime}</TableCell>

        <TableCell>{timeout} Seconds</TableCell>

        <TableCell align="right">
          <IconButton onClick={handleOpenMenu}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <Popover
        open={!!open}
        anchorEl={open}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: { width: 140 },
        }}
      >
        <MenuItem onClick={handleViewLogs}>
          <Iconify icon="eva:arrow-right-outline" sx={{ mr: 2 }} />
          View Logs
        </MenuItem>
      </Popover>
    </>
  );
}

FunctionTableRow.propTypes = {
  name: PropTypes.string,
  arn: PropTypes.string,
  ephemeralStorageSize: PropTypes.number,
  functionUpdatedAt: PropTypes.string,
  memorySize: PropTypes.number,
  runtime: PropTypes.string,
  timeout: PropTypes.number,
  handleClick: PropTypes.func,
  selected: PropTypes.any,
  lastInvokedAt: PropTypes.number,
  cold: PropTypes.bool,
  handleViewLogs: PropTypes.func,
  warmerArn: PropTypes.string,
  warmerTime: PropTypes.number,
  warmedAt: PropTypes.number,
};
