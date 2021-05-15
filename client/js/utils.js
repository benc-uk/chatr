import { toast } from 'https://cdn.jsdelivr.net/npm/bulma-toast@2.3.0/dist/bulma-toast.esm.js'

export default {
  uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  },

  toastMessage(msg, type) {
    toast({
      message: msg,
      type: `is-${type}`,
      duration: 1500,
      position: 'top-center',
      animate: { in: 'fadeIn', out: 'fadeOut' },
    })
  },
}
