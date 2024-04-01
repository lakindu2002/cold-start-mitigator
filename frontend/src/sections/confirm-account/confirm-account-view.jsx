import * as Yup from 'yup';
import { useFormik } from 'formik';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import { alpha, useTheme } from '@mui/material/styles';

import { bgGradient } from 'src/theme/css';
import { useAuth } from 'src/contexts/auth-context';

import Logo from 'src/components/logo';

// ----------------------------------------------------------------------

export default function ConfirmAccountView() {
  const theme = useTheme();

  const navigate = useNavigate();
  const { verifyCode } = useAuth();
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);

  const email = queryParams.get('email') || '';

  const form = useFormik({
    initialValues: {
      email,
      code: '',
    },
    validationSchema: Yup.object().shape({
      email: Yup.string().required('Email is valid').email('Not a valid email'),
      code: Yup.string().required('Code is required'),
    }),
    onSubmit: async (values) => {
      const { code, email: inputEmail } = values;
      try {
        await verifyCode(inputEmail, code);
        toast.success('Your account has been verified. Log in to the system to get started');
        navigate('/login');
      } catch (err) {
        toast.error('We ran into an error while confirming the user. Please try again');
      }
    },
  });

  const renderForm = (
    <>
      <Stack spacing={3}>
        <TextField
          name="email"
          label="Email address"
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          onReset={form.handleReset}
          value={form.values.email}
          error={Boolean(form.touched.email && form.errors.email)}
          helperText={form.touched.email && form.errors.email}
        />

        <TextField
          name="code"
          label="Verification Code"
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          onReset={form.handleReset}
          error={Boolean(form.touched.code && form.errors.code)}
          helperText={form.touched.code && form.errors.code}
        />
      </Stack>

      <LoadingButton
        loading={form.isSubmitting}
        fullWidth
        size="large"
        type="submit"
        sx={{ my: 1 }}
        variant="contained"
        color="inherit"
      >
        Verify Account
      </LoadingButton>
    </>
  );

  return (
    <Box
      sx={{
        ...bgGradient({
          color: alpha(theme.palette.background.default, 0.9),
          imgUrl: '/assets/background/overlay_4.jpg',
        }),
        height: 1,
      }}
    >
      <Logo
        sx={{
          position: 'fixed',
          top: { xs: 16, md: 24 },
          left: { xs: 16, md: 24 },
        }}
      />

      <Stack alignItems="center" justifyContent="center" sx={{ height: 1 }}>
        <Card
          sx={{
            p: 5,
            width: 1,
            maxWidth: 420,
          }}
        >
          <form noValidate onSubmit={form.handleSubmit}>
            <Typography variant="h4">Verify Account</Typography>

            <Typography variant="body2" sx={{ mt: 2, mb: 5 }}>
              An email was sent to your email with the verification code
            </Typography>

            {renderForm}
          </form>
        </Card>
      </Stack>
    </Box>
  );
}
