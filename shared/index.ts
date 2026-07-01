const CONFIRM_MARK_MARKER = "$$confirmMark$$"
export const CONFIRM_MARK_MARKER_BASE64 = btoa(CONFIRM_MARK_MARKER)

type RecordIds = { markRecordId: number, time: string }[]
export type confirmMarkData = {
    recordIds: RecordIds
}