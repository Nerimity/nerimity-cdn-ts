import { Request, Response } from 'hyper-express';


let numbers = "0123456789";

// groupId can:
// - be a userId for posts/avatars/banners
// - channelId for messages
export function isValidGroupId(groupId?: string) {
  if (!groupId) {
    return false;
  }

  for (let i = 0; i < groupId.length; i++) {
    if (!numbers.includes(groupId[i]!)) {
      return false;
    }
  }

  return true;
}

export const validGroupIdCheckMiddleware = async (req: Request, res: Response) => {
  if (!isValidGroupId(req.params.groupId)) {
    res.status(400).json({
      error: "Invalid groupId"
    })
  }
}