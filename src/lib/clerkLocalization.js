import { viVN } from '@clerk/localizations'

export const clerkLocalization = {
  ...viVN,
  signIn: {
    ...viVN.signIn,
    start: {
      ...viVN.signIn.start,
      title: 'Đăng nhập vào Cơm Trưa',
      subtitle: 'Đăng nhập bằng tài khoản Google của bạn để tiếp tục',
    },
  },
}
