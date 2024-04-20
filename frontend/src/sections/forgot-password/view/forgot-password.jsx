import * as Yup from 'yup';
import { useState } from 'react';
import { useFormik } from 'formik';
import { useNavigate } from 'react-router-dom';

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

const ForgotPasswordView = () => {
  const theme = useTheme();

  const { passwordRecovery, passwordReset } = useAuth();
  const [sendingCode, setSendingCode] = useState(false);
  const navigate = useNavigate();

  const form = useFormik({
    initialValues: {
      email: '',
      code: '',
      password: '',
    },
    validationSchema: Yup.object().shape({
      email: Yup.string().required('Email is valid').email('Not a valid email'),
      code: Yup.string().required('Code is required'),
      password: Yup.string().required('Password is required').min(6, 'Password is too short'),
    }),
    onSubmit: async (values) => {
      try {
        await passwordReset({
          username: values.email,
          confirmationCode: values.code,
          newPassword: values.password,
        });
        navigate('/login');
      } finally {
        form.setSubmitting(false);
      }
    },
  });

  const handleSendCode = async () => {
    setSendingCode(true);
    await passwordRecovery(form.values.email);
    setSendingCode(false);
  };

  const renderForm = (
    <>
      <Stack spacing={3}>
        <TextField
          name="email"
          label="Email address"
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          InputProps={{
            endAdornment: (
              <LoadingButton
                type="button"
                loading={sendingCode}
                size="small"
                disabled={!form.values.email}
                onClick={handleSendCode}
                variant="outlined"
              >
                Send Code
              </LoadingButton>
            ),
          }}
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
        <TextField
          name="password"
          label="New Password"
          type="password"
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          onReset={form.handleReset}
          error={Boolean(form.touched.password && form.errors.password)}
          helperText={form.touched.password && form.errors.password}
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
        Reset Password
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
            <Typography variant="h4">Forgot Password</Typography>

            <Typography variant="body2" sx={{ mt: 2, mb: 5 }}>
              Enter your email address and we will send you a code to reset your password
            </Typography>

            {renderForm}
          </form>
        </Card>
      </Stack>
    </Box>
  );
};

export default ForgotPasswordView;
