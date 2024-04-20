import * as Yup from 'yup';
import { useState } from 'react';
import { useFormik } from 'formik';
import toast from 'react-hot-toast';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import { alpha, useTheme } from '@mui/material/styles';
import InputAdornment from '@mui/material/InputAdornment';

import { bgGradient } from 'src/theme/css';
import { useAuth } from 'src/contexts/auth-context';

import Logo from 'src/components/logo';
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

export default function LoginView() {
  const theme = useTheme();

  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();

  const form = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object().shape({
      email: Yup.string().required('Email is valid').email('Not a valid email'),
      password: Yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      const { email, password } = values;
      try {
        await login(email, password);
      } catch (err) {
        console.log(err);
        toast.error('Invalid email or password');
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
          error={Boolean(form.touched.email && form.errors.email)}
          helperText={form.touched.email && form.errors.email}
        />

        <TextField
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          onReset={form.handleReset}
          error={Boolean(form.touched.email && form.errors.email)}
          helperText={form.touched.email && form.errors.email}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                  <Iconify icon={showPassword ? 'eva:eye-fill' : 'eva:eye-off-fill'} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ my: 3 }}>
        <Link variant="subtitle2" underline="hover" href="/password-recovery">
          Forgot password?
        </Link>
      </Stack>

      <LoadingButton
        loading={form.isSubmitting}
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        color="inherit"
      >
        Login
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
            <Typography variant="h4">Sign in to HeatShield</Typography>

            <Typography variant="body2" sx={{ mt: 2, mb: 5 }}>
              Don’t have an account?
              <Link variant="subtitle2" sx={{ ml: 0.5 }} href="/register">
                Get started
              </Link>
            </Typography>

            {renderForm}
          </form>
        </Card>
      </Stack>
    </Box>
  );
}
